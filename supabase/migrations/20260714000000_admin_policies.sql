-- Accès lecture pour l'admin authentifié.
--
-- L'admin Next.js se connecte à Supabase avec la clé ANON + la session de
-- l'utilisateur, jamais avec la clé service_role : celle-ci resterait exposée
-- à quiconque obtient un accès au serveur de l'admin, et contourne toute RLS.
-- On ouvre donc précisément ce dont l'admin a besoin, en LECTURE SEULE.
--
-- Rappel : la migration 20260713010000 avait révoqué tous les privilèges au rôle
-- `authenticated`. Il faut donc les redonner ici, en plus des policies.
-- Sans le GRANT, la policy ne suffirait pas (Postgres vérifie les deux).

grant select on public.conversations to authenticated;
grant select on public.messages      to authenticated;
grant select on public.leads         to authenticated;

-- Tout compte présent dans auth.users est un administrateur : les comptes sont
-- créés à la main dans le dashboard Supabase, l'inscription publique doit être
-- DÉSACTIVÉE (Authentication > Providers > Email > "Enable sign-ups" à off).
create policy "admin lit les conversations"
  on public.conversations for select
  to authenticated
  using (true);

create policy "admin lit les messages"
  on public.messages for select
  to authenticated
  using (true);

create policy "admin lit les leads"
  on public.leads for select
  to authenticated
  using (true);

-- `documents` reste fermé : l'admin n'a pas besoin de lire les embeddings, et
-- les exposer n'apporterait rien. Le rôle `anon` (le widget) reste sans aucun
-- accès direct à la base : il ne parle qu'au backend.
