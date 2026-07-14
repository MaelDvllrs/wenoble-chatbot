# Wenoble Chatbot

Chatbot RAG pour le site de l'agence Wenoble. Monorepo npm workspaces.

À ce stade, seule la structure existe : pas de RAG, pas d'appel Claude réel dans les routes.
Le seul endpoint fonctionnel est le healthcheck.

## Structure

```
wenoble-chatbot/
├── backend/              Serveur Fastify (TypeScript) — API du chatbot
│   ├── src/routes/       Routes HTTP (GET /health)
│   ├── src/services/     Logique métier (à venir : chat, RAG, embeddings, leads)
│   └── src/lib/          Clients et config (env, logger, supabase, anthropic)
├── admin/                Next.js App Router — visualisation conversations & leads
│   ├── app/              Pages
│   └── lib/auth/         TODO : auth de l'admin (vide pour l'instant)
├── scripts/              Scripts d'ingestion (chunking + embeddings du site/brandbook)
├── widget/               Widget de chat vanilla JS, sans build step
└── supabase/migrations/  Migrations SQL (pgvector + tables)
```

## Stack

| Brique      | Choix                                                       |
| ----------- | ----------------------------------------------------------- |
| Backend     | Fastify 5, TypeScript, pino, zod                            |
| Base        | Supabase (Postgres + pgvector)                              |
| LLM         | API Claude (`@anthropic-ai/sdk`, modèle `claude-opus-4-8`)  |
| Embeddings  | Voyage AI (1024 dimensions)                                 |
| Admin       | Next.js 15 (App Router), Tailwind CSS 4                     |
| Widget      | JS vanilla                                                  |

## Démarrage

Prérequis : Node.js ≥ 20.

```bash
npm install            # à la racine — installe tous les workspaces
```

### Variables d'environnement

```bash
cp backend/.env.example backend/.env
cp scripts/.env.example scripts/.env
cp admin/.env.local.example admin/.env.local
```

Puis renseigner les valeurs :

| Variable                    | Où               | Rôle                                                    |
| --------------------------- | ---------------- | ------------------------------------------------------- |
| `SUPABASE_URL`              | backend, scripts | URL du projet Supabase                                  |
| `SUPABASE_SERVICE_ROLE_KEY` | backend, scripts | Clé service_role — **serveur uniquement**, jamais côté client |
| `ANTHROPIC_API_KEY`         | backend, scripts | Clé API Claude                                          |
| `VOYAGE_API_KEY`            | backend, scripts | Clé API Voyage AI (embeddings)                          |
| `PORT`                      | backend          | Port du serveur Fastify (défaut : 3001)                 |
| `NODE_ENV`                  | backend          | `development` \| `production` \| `test`                 |
| `ALLOWED_ORIGINS`           | backend          | Origines autorisées par CORS, séparées par des virgules |
| `NEXT_PUBLIC_SUPABASE_URL`  | admin            | Même URL Supabase, exposée au navigateur                |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | admin        | Clé **anon** (soumise aux RLS) — jamais la service_role |
| `NEXT_PUBLIC_BACKEND_URL`   | admin            | URL du backend Fastify                                  |

Le backend valide ses variables au démarrage (zod) et s'arrête avec un message explicite s'il en manque une.

### Lancer chaque partie

```bash
npm run dev:backend    # Fastify avec hot reload (tsx watch) → http://localhost:3001
npm run dev:admin      # Next.js                              → http://localhost:3000
npm run dev:widget     # Sert widget/ en statique             → http://localhost:3000 (autre port si occupé)
```

Vérifier que le backend répond :

```bash
curl http://localhost:3001/health   # {"status":"ok"}
```

### Base de données

Appliquer la migration `supabase/migrations/20260713000000_init.sql` — soit via le SQL Editor du
dashboard Supabase, soit avec la CLI (`supabase db push` après `supabase link`).

Elle active pgvector et crée `documents`, `conversations`, `messages`, `leads`, avec un index HNSW
cosinus sur `documents.embedding`.

La RLS est activée sur les quatre tables **sans aucune policy** : la clé anon ne peut donc rien lire.
Le backend passe par la clé service_role, qui contourne la RLS. Il faudra ajouter des policies de
lecture en même temps que l'auth de l'admin.

## Prochaines étapes

1. Écrire `scripts/src/chunk.ts` et `scripts/src/embed.ts`, puis remplir `documents`.
2. Créer la fonction SQL `match_documents(query_embedding, match_count)` pour la recherche de similarité.
3. Implémenter `POST /chat` dans le backend (RAG + appel Claude en streaming).
4. Brancher `widget.js` sur `POST /chat`.
5. Ajouter l'auth de l'admin (`admin/lib/auth/`) et les policies RLS associées.
6. Détection et persistance des leads.
