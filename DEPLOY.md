# Déploiement

Tout est sur Vercel : plus de VPS, plus de PM2, plus de reverse proxy.

| Composant | Projet Vercel | Root Directory | Domaine |
| --- | --- | --- | --- |
| API + widget | `wenoble-api` | `api` | `ask-ai.wenoble.fr` |
| Admin | `wenoble-admin` | `admin` | `admin.wenoble.fr` |
| Base de données | Supabase | — | — |

Le widget (`widget.js`, `widget.css`) est servi par le projet API, depuis
`api/public/widget/`. Le site n'a donc qu'**une seule origine** à connaître.

---

## 0. Supabase (à faire en premier)

Applique les migrations dans le SQL Editor, dans l'ordre :

```
supabase/migrations/20260713000000_init.sql
supabase/migrations/20260713010000_enable_rls.sql
supabase/migrations/20260713020000_rag.sql
supabase/migrations/20260714000000_admin_policies.sql
supabase/migrations/20260714010000_rate_limit.sql   ← indispensable en serverless
```

Puis, dans **Authentication → Providers → Email** : garder le provider **activé**,
mais désactiver **« Allow new users to sign up »**. Crée ton compte admin à la
main dans **Authentication → Users**, en cochant **Auto Confirm User**.

Sans cela, n'importe qui pourrait s'inscrire et lire toutes les conversations :
les policies considèrent tout compte authentifié comme administrateur.

---

## 1. API (projet Vercel n°1)

```bash
npm i -g vercel
cd wenoble-chatbot/api
vercel login
vercel link          # nommer le projet, ex. wenoble-api
```

Variables d'environnement — **avant** le premier déploiement :

```bash
vercel env add SUPABASE_URL production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add ANTHROPIC_API_KEY production
vercel env add CHAT_MODEL production                 # claude-sonnet-5
vercel env add VOYAGE_API_KEY production
vercel env add VOYAGE_MODEL production               # voyage-3
vercel env add ALLOWED_ORIGINS production            # https://wenoble.fr,https://www.wenoble.fr
vercel env add COOKIE_SECRET production              # nouveau secret, 32+ caractères
vercel env add COOKIE_SAMESITE production            # lax
vercel env add RATE_LIMIT_MAX production             # 20
vercel env add RATE_LIMIT_WINDOW_SECONDS production  # 300
vercel env add MAX_MESSAGES_PER_CONVERSATION production  # 40
```

Générer le secret :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Puis :

```bash
vercel --prod
```

Enfin, dans le dashboard Vercel → **Settings → Domains**, ajoute
`ask-ai.wenoble.fr`.

`COOKIE_SAMESITE=lax` suffit : `wenoble.fr` et `ask-ai.wenoble.fr` partagent le
même domaine racine, donc le **même site** au sens des cookies. Aucune dépendance
aux cookies tiers.

### Vérification

```bash
curl https://ask-ai.wenoble.fr/health              # {"status":"ok"}
curl -I https://ask-ai.wenoble.fr/widget/widget.js # 200
```

---

## 2. Admin (projet Vercel n°2)

```bash
cd wenoble-chatbot/admin
vercel link          # nommer le projet, ex. wenoble-admin

vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add NEXT_PUBLIC_BACKEND_URL production    # https://ask-ai.wenoble.fr

vercel --prod
```

**Ne jamais mettre `SUPABASE_SERVICE_ROLE_KEY` sur ce projet.** L'admin lit la
base avec la clé `anon` + la session de l'utilisateur : c'est la RLS qui protège
les données. La clé `service_role` n'existe que sur le projet API.

Ajoute l'URL de l'admin dans Supabase → **Authentication → URL Configuration →
Redirect URLs**, sinon la connexion refusera de rediriger.

---

## 3. Intégration du widget sur le site

Webflow → **Project Settings → Custom Code → Footer** :

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

**Code** : `vercel --prod` depuis `api/` ou `admin/` (ou un `git push` si le
projet est relié au dépôt).

**Contenu**, après une modification du site :

```bash
npm run chunk --workspace scripts   # crawl + découpage, ne consomme aucun token
npm run embed --workspace scripts   # n'embedde que les chunks modifiés
```

Aucun redéploiement n'est nécessaire : le sitemap est reconstruit à chaque cold
start de la fonction. C'est un avantage du serverless sur l'ancien VPS, où il
fallait redémarrer le process.

---

## Notes sur le passage au serverless

**La limitation de débit est comptée en base**, pas en mémoire
(`supabase/migrations/20260714010000_rate_limit.sql`). En serverless, chaque
requête peut atterrir sur une instance neuve : un compteur en mémoire ne serait
partagé par personne et ne protégerait plus rien. La fonction SQL
`check_rate_limit` fait l'incrément et le test en une seule instruction, donc de
façon atomique — deux instances concurrentes ne peuvent pas passer à travers.

**Le streaming SSE fonctionne**, via un `ReadableStream` renvoyé par le Route
Handler. `maxDuration = 60` (secondes) : une réponse prend ~10 s, la marge est
large. À surveiller uniquement si tu augmentes beaucoup `MAX_TOKENS`.

**Le system prompt est un `.md` lu au runtime.** Il n'est embarqué dans le bundle
que grâce à `outputFileTracingIncludes` dans `api/next.config.ts`. Sans cette
directive, la route `/chat` planterait en production avec un `ENOENT`, alors que
tout marcherait en local.
