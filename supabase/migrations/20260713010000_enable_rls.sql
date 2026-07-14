-- Active la Row Level Security sur les quatre tables du chatbot.
--
-- Idempotent : peut être rejoué sans risque si la migration initiale a déjà
-- activé la RLS (ou si elle n'a été appliquée que partiellement).
--
-- Posture : RLS activée SANS aucune policy => tout accès via les rôles `anon`
-- et `authenticated` est refusé par défaut. Le backend passe par la clé
-- service_role, qui contourne la RLS. Les policies de lecture pour l'admin
-- authentifié seront ajoutées avec la mise en place de l'auth.

alter table public.documents     enable row level security;
alter table public.conversations enable row level security;
alter table public.messages      enable row level security;
alter table public.leads         enable row level security;

-- `force` : la RLS s'applique aussi au propriétaire de la table (utile si un
-- script se connecte avec le rôle propriétaire plutôt qu'avec service_role).
alter table public.documents     force row level security;
alter table public.conversations force row level security;
alter table public.messages      force row level security;
alter table public.leads         force row level security;

-- Ceinture et bretelles : on retire aussi les privilèges de table accordés par
-- défaut aux rôles exposés via PostgREST. Sans policy, la RLS suffirait déjà,
-- mais cela ferme la porte même si une policy trop large était ajoutée par erreur.
revoke all on public.documents     from anon, authenticated;
revoke all on public.conversations from anon, authenticated;
revoke all on public.messages      from anon, authenticated;
revoke all on public.leads         from anon, authenticated;

-- Vérification : les 4 tables doivent remonter avec rowsecurity = true.
--   select relname, relrowsecurity, relforcerowsecurity
--   from pg_class
--   where relnamespace = 'public'::regnamespace
--     and relname in ('documents', 'conversations', 'messages', 'leads');
