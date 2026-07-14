-- Limitation de débit persistée en base.
--
-- En serverless (Vercel), chaque requête peut tomber sur une instance neuve :
-- un compteur en mémoire (comme celui de @fastify/rate-limit) ne serait donc
-- partagé par personne et ne protégerait plus rien. Le compteur doit vivre dans
-- un stockage commun. Postgres suffit : pas besoin d'ajouter Redis.

create table if not exists public.rate_limits (
  key          text primary key,   -- ex. 'chat:82.65.12.4'
  count        int not null default 0,
  window_start timestamptz not null default now()
);

alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

/**
 * Incrémente le compteur et dit si la requête est autorisée.
 *
 * Tout est fait en UNE seule instruction : la lecture, la remise à zéro de la
 * fenêtre et l'incrément sont donc atomiques. Un « lire puis écrire » en deux
 * temps laisserait passer des requêtes concurrentes (deux instances lisant la
 * même valeur avant que l'une n'écrive), ce qui est précisément le scénario
 * qu'on veut empêcher en serverless.
 *
 * Retourne true si la requête est acceptée, false si la limite est atteinte.
 */
create or replace function public.check_rate_limit (
  p_key text,
  p_max int,
  p_window_seconds int
)
returns boolean
language sql
volatile
as $$
  insert into public.rate_limits as r (key, count, window_start)
  values (p_key, 1, now())
  on conflict (key) do update
    set
      -- Fenêtre expirée : on repart de 1. Sinon on incrémente.
      count = case
        when r.window_start < now() - make_interval(secs => p_window_seconds) then 1
        else r.count + 1
      end,
      window_start = case
        when r.window_start < now() - make_interval(secs => p_window_seconds) then now()
        else r.window_start
      end
  returning r.count <= p_max;
$$;

revoke all on function public.check_rate_limit(text, int, int) from anon, authenticated;

-- Purge des clés inactives : sans elle, la table grossit indéfiniment (une
-- ligne par IP vue). À appeler de temps en temps, ou via un cron Supabase.
create or replace function public.purge_rate_limits()
returns void
language sql
volatile
as $$
  delete from public.rate_limits where window_start < now() - interval '1 day';
$$;
