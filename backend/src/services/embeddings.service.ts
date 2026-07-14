import { env } from '../lib/env.js';
import { EMBEDDING_DIMENSIONS } from '../lib/anthropic.js';

const VOYAGE_URL = 'https://api.voyageai.com/v1/embeddings';

/**
 * `input_type` compte : Voyage encode différemment un document indexé et une
 * question. Utiliser le mauvais dégrade la qualité de la recherche.
 */
type InputType = 'query' | 'document';

interface VoyageResponse {
  data: { embedding: number[]; index: number }[];
  usage: { total_tokens: number };
}

export async function embed(texts: string[], inputType: InputType): Promise<number[][]> {
  if (texts.length === 0) return [];

  const res = await fetch(VOYAGE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({
      input: texts,
      model: env.VOYAGE_MODEL,
      input_type: inputType,
    }),
  });

  if (!res.ok) {
    throw new Error(`Voyage ${res.status} : ${await res.text()}`);
  }

  const json = (await res.json()) as VoyageResponse;

  // Voyage ne garantit pas l'ordre des résultats : on réordonne via `index`.
  const ordered = json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);

  const dim = ordered[0]?.length;
  if (dim && dim !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Le modèle ${env.VOYAGE_MODEL} renvoie des vecteurs de ${dim} dimensions, ` +
        `mais la colonne documents.embedding est en vector(${EMBEDDING_DIMENSIONS}).`,
    );
  }

  return ordered;
}

/** Embedde une question de visiteur. */
export async function embedQuery(text: string): Promise<number[]> {
  const [vector] = await embed([text], 'query');
  if (!vector) throw new Error('Voyage a renvoyé un embedding vide.');
  return vector;
}
