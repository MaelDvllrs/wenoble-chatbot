-- RAG : déduplication des chunks + fonction de recherche par similarité.

-- Le hash du contenu identifie un chunk de façon stable. Il permet à
-- `embed.ts` de ne ré-embedder que ce qui a réellement changé (les tokens
-- Voyage ne sont donc pas payés deux fois pour le même texte) et empêche
-- d'insérer deux fois le même passage.
alter table public.documents add column if not exists hash text;

create unique index if not exists documents_hash_key on public.documents (hash);

/**
 * Recherche les chunks les plus proches d'un vecteur de question.
 *
 * `1 - (embedding <=> query)` : l'opérateur <=> de pgvector renvoie une
 * DISTANCE cosinus (0 = identique). On la convertit en SIMILARITÉ (1 = identique)
 * pour que le tri « du plus pertinent au moins pertinent » soit un ORDER BY DESC
 * lisible côté application.
 *
 * Le tri interne reste sur `embedding <=> query_embedding` (ASC) : c'est la
 * forme que l'index HNSW sait exploiter. Trier sur l'expression inversée
 * ferait une recherche exhaustive (seq scan) au lieu d'utiliser l'index.
 */
create or replace function public.match_documents (
  query_embedding vector(1024),
  match_count int default 5,
  min_similarity float default 0.0
)
returns table (
  id uuid,
  source text,
  content text,
  metadata jsonb,
  similarity float
)
language sql
stable
as $$
  select
    d.id,
    d.source,
    d.content,
    d.metadata,
    1 - (d.embedding <=> query_embedding) as similarity
  from public.documents d
  where d.embedding is not null
    and 1 - (d.embedding <=> query_embedding) >= min_similarity
  order by d.embedding <=> query_embedding
  limit match_count;
$$;

-- La fonction n'est appelée que par le backend (clé service_role).
revoke all on function public.match_documents(vector, int, float) from anon, authenticated;
