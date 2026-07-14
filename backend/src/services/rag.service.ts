import { supabase } from '../lib/supabase.js';
import { embedQuery } from './embeddings.service.js';

export interface Match {
  id: string;
  source: string;
  content: string;
  metadata: { type?: 'site' | 'blog' | 'brandbook'; title?: string; url?: string };
  similarity: number;
}

/** Nombre de chunks finalement injectés dans le prompt. */
const TOP_K = 5;

/** On en récupère plus que nécessaire pour pouvoir re-classer avant de couper. */
const CANDIDATES = 15;

/** En dessous, le chunk n'a probablement rien à voir avec la question. */
const MIN_SIMILARITY = 0.35;

/**
 * Pénalité appliquée aux articles de blog.
 *
 * Le blog représente l'écrasante majorité des chunks : sans cela, une question
 * sur Wenoble ("vous faites quoi ?") remonte surtout des articles éditoriaux,
 * et les pages agence sont noyées. On ne les exclut pas — ils restent utiles sur
 * les questions techniques, où ils gagnent malgré la pénalité.
 */
const BLOG_PENALTY = 0.08;

function score(match: Match): number {
  return match.metadata?.type === 'blog' ? match.similarity - BLOG_PENALTY : match.similarity;
}

/** Retrouve les passages pertinents pour une question. */
export async function retrieve(question: string): Promise<Match[]> {
  const embedding = await embedQuery(question);

  const { data, error } = await supabase.rpc('match_documents', {
    query_embedding: embedding,
    match_count: CANDIDATES,
    min_similarity: MIN_SIMILARITY,
  });

  if (error) throw new Error(`match_documents : ${error.message}`);

  return ((data ?? []) as Match[]).sort((a, b) => score(b) - score(a)).slice(0, TOP_K);
}

/**
 * Met les passages en forme pour le prompt.
 * Les balises XML aident le modèle à distinguer le contexte de la question.
 */
export function formatContext(matches: Match[]): string {
  if (matches.length === 0) return '';

  const blocks = matches
    .map((m) => {
      const title = m.metadata?.title ?? m.source;
      return `<extrait source="${m.source}" titre="${escapeAttr(title)}">\n${m.content}\n</extrait>`;
    })
    .join('\n\n');

  return `<contexte>\n${blocks}\n</contexte>`;
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
