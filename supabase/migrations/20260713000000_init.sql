-- Schéma initial du chatbot Wenoble : RAG (documents) + conversations, messages, leads.

create extension if not exists vector;
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- --- RAG : chunks du site et du brandbook ---
create table if not exists public.documents (
  id         uuid primary key default gen_random_uuid(),
  source     text not null,              -- ex. 'site:/services', 'brandbook:p12'
  content    text not null,
  embedding  vector(1024),               -- Voyage AI (voyage-3) = 1024 dimensions
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Index de similarité cosinus. HNSW : meilleur rappel que ivfflat et pas besoin
-- de reconstruire l'index quand le volume de données change.
create index if not exists documents_embedding_hnsw_idx
  on public.documents
  using hnsw (embedding vector_cosine_ops);

create index if not exists documents_source_idx on public.documents (source);

-- --- Conversations ---
create table if not exists public.conversations (
  id         uuid primary key default gen_random_uuid(),
  session_id text not null,              -- identifiant anonyme généré par le widget
  status     text not null default 'open' check (status in ('open', 'closed', 'archived')),
  created_at timestamptz not null default now()
);

create index if not exists conversations_session_id_idx on public.conversations (session_id);

-- --- Messages ---
create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role            text not null check (role in ('user', 'assistant', 'system')),
  content         text not null,
  created_at      timestamptz not null default now()
);

create index if not exists messages_conversation_id_created_at_idx
  on public.messages (conversation_id, created_at);

-- --- Leads captés en conversation ---
create table if not exists public.leads (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  email           text,
  phone           text,
  name            text,
  created_at      timestamptz not null default now()
);

create index if not exists leads_conversation_id_idx on public.leads (conversation_id);
create index if not exists leads_created_at_idx on public.leads (created_at desc);

-- --- Row Level Security ---
-- RLS activée sans policy : tout accès via la clé anon est refusé. Le backend
-- utilise la clé service_role, qui contourne RLS. Des policies de lecture pour
-- l'admin authentifié seront ajoutées avec la mise en place de l'auth.
alter table public.documents     enable row level security;
alter table public.conversations enable row level security;
alter table public.messages      enable row level security;
alter table public.leads         enable row level security;
