# Déploiement

Architecture cible :

| Composant | Hébergement | URL |
| --- | --- | --- |
| Backend Fastify | VPS (PM2 + nginx) | `https://ask-ai.wenoble.fr` |
| Widget (JS/CSS) | servi par le backend | `https://ask-ai.wenoble.fr/widget/widget.js` |
| Admin Next.js | Vercel | `https://admin.wenoble.fr` (ou `*.vercel.app`) |
| Base de données | Supabase | — |

Le widget est servi par le backend : le site n'a donc qu'**une seule origine** à
connaître, et il n'y a pas de second hébergement à maintenir.

---

## 1. Backend sur le VPS

### Prérequis

Node 20+, nginx, PM2, et un utilisateur dédié (le backend ne doit pas tourner en
root) :

```bash
sudo npm install -g pm2
sudo adduser --system --group --home /opt/wenoble-chatbot wenoble
```

### Déploiement

```bash
sudo -u wenoble git clone <url-du-depot> /opt/wenoble-chatbot
cd /opt/wenoble-chatbot
sudo -u wenoble npm ci
sudo -u wenoble npm run build --workspace backend
```

### Variables d'environnement

Crée `/opt/wenoble-chatbot/backend/.env` :

```bash
NODE_ENV=production
PORT=3001

SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
ANTHROPIC_API_KEY=...
CHAT_MODEL=claude-sonnet-5
VOYAGE_API_KEY=...
VOYAGE_MODEL=voyage-3

# Uniquement le site. Pas de localhost en production.
ALLOWED_ORIGINS=https://wenoble.fr,https://www.wenoble.fr

# NOUVEAU secret, différent de celui de dev :
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
COOKIE_SECRET=...
COOKIE_SAMESITE=lax
COOKIE_DOMAIN=

RATE_LIMIT_MAX=20
RATE_LIMIT_WINDOW=5 minutes
MAX_MESSAGES_PER_CONVERSATION=40
```

Ce fichier contient la clé `service_role`, qui **contourne toute RLS** :

```bash
sudo chown wenoble:wenoble /opt/wenoble-chatbot/backend/.env
sudo chmod 600 /opt/wenoble-chatbot/backend/.env
```

`COOKIE_SAMESITE=lax` suffit car `wenoble.fr` et `ask-ai.wenoble.fr` partagent le
même domaine racine : pour le navigateur, c'est le **même site**. Pas besoin de
`SameSite=None`, donc aucune dépendance aux cookies tiers.

`NODE_ENV=production` active automatiquement le flag `Secure` du cookie et
`trustProxy` (IP réelle du visiteur derrière nginx).

### Lancement avec PM2

```bash
cd /opt/wenoble-chatbot
sudo -u wenoble pm2 start deploy/ecosystem.config.cjs
sudo -u wenoble pm2 save        # persiste la liste des process
sudo -u wenoble pm2 startup     # relance PM2 au reboot (suivre la commande affichée)

sudo -u wenoble pm2 logs wenoble-chatbot
sudo -u wenoble pm2 status
```

Le backend tourne en mode **`fork`, une seule instance** — c'est délibéré. En
mode `cluster`, chaque worker aurait sa propre mémoire, donc son propre compteur
de rate limit (`@fastify/rate-limit` stocke en mémoire) : la limite réelle serait
multipliée par le nombre de workers, et un abuseur pourrait envoyer N × 20
requêtes. Le backend passe l'essentiel de son temps à attendre Claude, Voyage et
Supabase : un seul process encaisse largement le trafic d'un site vitrine. Passer
en cluster imposerait d'abord de déporter le rate limit dans Redis.

### Reverse proxy

**Apache et nginx ne peuvent pas écouter le même port.** Si Apache tourne déjà
sur le VPS (autres services), utilise-le comme reverse proxy et ignore nginx :
c'est la même fonction, et rien d'autre n'est à toucher.

#### Option A — Apache (si déjà installé)

```bash
sudo a2enmod proxy proxy_http headers
sudo cp deploy/apache.conf /etc/apache2/sites-available/ask-ai.wenoble.fr.conf
sudo a2ensite ask-ai.wenoble.fr
sudo apache2ctl configtest && sudo systemctl reload apache2
sudo certbot --apache -d ask-ai.wenoble.fr
```

Le vhost désactive **mod_deflate** (`no-gzip`, `RequestHeader unset
Accept-Encoding`) sur ce domaine. C'est indispensable : en compressant le flux
SSE, Apache l'accumulerait dans un tampon et le visiteur ne verrait rien arriver
avant la fin de la réponse. Le streaming serait perdu.

#### Option B — nginx (si Apache n'est pas là)

Vérifie d'abord quel dossier ta conf nginx inclut — sinon le fichier serait
ignoré silencieusement :

```bash
grep -rE "include.*(sites-enabled|conf\.d)" /etc/nginx/nginx.conf
```

Puis, selon le cas :

```bash
# Si sites-enabled est inclus (le lien depuis sites-available est facultatif :
# c'est une convention Debian, pas une exigence de nginx)
sudo cp deploy/nginx.conf /etc/nginx/sites-enabled/ask-ai.wenoble.fr

# Si seul conf.d est inclus — le nom DOIT finir par .conf
sudo cp deploy/nginx.conf /etc/nginx/conf.d/ask-ai.wenoble.fr.conf
```

```bash
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d ask-ai.wenoble.fr
```

HTTPS n'est pas optionnel : le cookie de session est `Secure` en production, un
navigateur le refuserait en HTTP et la conversation ne survivrait pas au refresh.

La conf nginx désactive `proxy_buffering` — **indispensable** : sans cela, nginx
retient la réponse de `/chat` et la livre d'un bloc, ce qui annule le streaming.

### Vérification

```bash
curl https://ask-ai.wenoble.fr/health          # {"status":"ok"}
curl -I https://ask-ai.wenoble.fr/widget/widget.js
```

---

## 2. Admin sur Vercel

Le déploiement se fait **depuis la racine du monorepo**, pas depuis `admin/`.
C'est ce que décrit [vercel.json](vercel.json) : `npm install` à la racine (le
`package-lock.json` y est, npm workspaces oblige), puis build de l'admin seul, et
sortie dans `admin/.next`.

Déployer `admin/` directement échouerait : Vercel n'y trouverait pas le lockfile.

### Avec le CLI

```bash
npm i -g vercel
cd wenoble-chatbot     # la racine du monorepo, PAS admin/
vercel login
vercel link            # crée le projet (ou le relie à un projet existant)
```

Variables d'environnement — à faire **avant** le premier déploiement, sinon le
build produit une app qui ne peut pas joindre Supabase :

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add NEXT_PUBLIC_BACKEND_URL production   # https://ask-ai.wenoble.fr
```

Répète avec `preview` si tu veux des déploiements de preview fonctionnels.

Puis :

```bash
vercel --prod
```

Pour vérifier ce qui est configuré : `vercel env ls`.

**Ne jamais mettre `SUPABASE_SERVICE_ROLE_KEY` dans Vercel.** L'admin lit la base
avec la clé `anon` + la session de l'utilisateur : c'est la RLS qui protège les
données. La clé `service_role` reste sur le VPS, exclusivement.

Dans Supabase → **Authentication → URL Configuration**, ajoute l'URL Vercel dans
les *Redirect URLs*.

---

## 3. Intégration du widget sur le site

Dans Webflow → **Project Settings → Custom Code → Footer**, ou juste avant
`</body>` :

```html
<link rel="stylesheet" href="https://ask-ai.wenoble.fr/widget/widget.css" />
<script>
  window.WENOBLE_CHAT_CONFIG = {
    backendUrl: 'https://ask-ai.wenoble.fr',
  };
</script>
<script src="https://ask-ai.wenoble.fr/widget/widget.js" defer></script>
```

---

## 4. Mises à jour

**Backend :**

```bash
cd /opt/wenoble-chatbot
sudo -u wenoble git pull
sudo -u wenoble npm ci
sudo -u wenoble npm run build --workspace backend
pm2 restart wenoble-chatbot
```

**Admin :** un `git push` suffit, Vercel redéploie.

**Contenu (après une modification du site) :**

```bash
npm run chunk --workspace scripts   # ne consomme aucun token
npm run embed --workspace scripts   # n'embedde que les chunks modifiés
pm2 restart wenoble-chatbot
```

Le redémarrage est **nécessaire** : le sitemap injecté dans le system prompt est
construit une seule fois au démarrage (il doit rester identique d'une requête à
l'autre pour que le prompt caching d'Anthropic fonctionne). Sans redémarrage, les
nouvelles pages resteront invisibles pour le modèle.
