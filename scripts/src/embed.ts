/**
 * Étape 2 de l'ingestion : embedder les chunks et remplir la table `documents`.
 *
 *   npm run embed --workspace scripts
 *
 * Incrémental : seuls les chunks dont le hash n'est PAS déjà en base sont
 * envoyés à Voyage. Relancer le script après une modification mineure du site
 * ne re-paie donc que les chunks réellement modifiés.
 */
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import type { Chunk } from './types.js';

const INPUT = '.cache/chunks.json';
const VOYAGE_URL = 'https://api.voyageai.com/v1/embeddings';
const VOYAGE_MODEL = process.env.VOYAGE_MODEL ?? 'voyage-3';
const EMBEDDING_DIMENSIONS = 1024;

/** Voyage accepte plusieurs textes par requête ; on reste prudent sur la taille. */
const BATCH_SIZE = 64;

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VOYAGE_API_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !VOYAGE_API_KEY) {
  console.error('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY et VOYAGE_API_KEY sont requis.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function embedBatch(texts: string[]): Promise<number[][]> {
  const res = await fetch(VOYAGE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${VOYAGE_API_KEY}`,
    },
    // input_type: 'document' — les chunks sont indexés, pas interrogés.
    // Le backend utilisera 'query' pour les questions.
    body: JSON.stringify({ input: texts, model: VOYAGE_MODEL, input_type: 'document' }),
  });

  if (!res.ok) throw new Error(`Voyage ${res.status} : ${await res.text()}`);

  const json = (await res.json()) as {
    data: { embedding: number[]; index: number }[];
    usage: { total_tokens: number };
  };

  const ordered = json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);

  const dim = ordered[0]?.length;
  if (dim !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `${VOYAGE_MODEL} renvoie ${dim} dimensions, la colonne attend vector(${EMBEDDING_DIMENSIONS}).`,
    );
  }

  return ordered;
}

/** Hashes déjà présents en base (pagination : Supabase plafonne à 1000 lignes). */
async function existingHashes(): Promise<Set<string>> {
  const hashes = new Set<string>();
  const PAGE = 1000;

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('documents')
      .select('hash')
      .range(from, from + PAGE - 1);

    if (error) throw new Error(`documents.select : ${error.message}`);
    if (!data || data.length === 0) break;

    for (const row of data) if (row.hash) hashes.add(row.hash);
    if (data.length < PAGE) break;
  }

  return hashes;
}

async function main() {
  const chunks: Chunk[] = JSON.parse(await readFile(INPUT, 'utf8'));
  console.log(`${chunks.length} chunk(s) dans ${INPUT}`);

  const known = await existingHashes();
  console.log(`${known.size} chunk(s) déjà en base`);

  const todo = chunks.filter((c) => !known.has(c.hash));
  const wanted = new Set(chunks.map((c) => c.hash));
  const stale = [...known].filter((h) => !wanted.has(h));

  if (todo.length === 0 && stale.length === 0) {
    console.log('\nRien à faire : la base est à jour.');
    return;
  }

  // --- Suppression des chunks obsolètes (contenu supprimé ou modifié) ---
  if (stale.length > 0) {
    console.log(`\n→ Suppression de ${stale.length} chunk(s) obsolète(s)`);
    for (let i = 0; i < stale.length; i += 100) {
      const { error } = await supabase
        .from('documents')
        .delete()
        .in('hash', stale.slice(i, i + 100));
      if (error) throw new Error(`documents.delete : ${error.message}`);
    }
  }

  // --- Embedding + insertion des nouveaux chunks ---
  if (todo.length > 0) {
    const tokens = Math.round(todo.reduce((s, c) => s + c.content.length, 0) / 4);
    console.log(`\n→ ${todo.length} nouveau(x) chunk(s) à embedder (~${tokens.toLocaleString('fr-FR')} tokens)`);

    for (let i = 0; i < todo.length; i += BATCH_SIZE) {
      const batch = todo.slice(i, i + BATCH_SIZE);
      const vectors = await embedBatch(batch.map((c) => c.content));

      const rows = batch.map((chunk, j) => ({
        source: chunk.source,
        content: chunk.content,
        hash: chunk.hash,
        embedding: vectors[j],
        metadata: chunk.metadata,
      }));

      // upsert sur `hash` : si deux runs se chevauchent, on ne duplique pas.
      const { error } = await supabase.from('documents').upsert(rows, { onConflict: 'hash' });
      if (error) throw new Error(`documents.upsert : ${error.message}`);

      console.log(`  ${Math.min(i + BATCH_SIZE, todo.length)}/${todo.length}`);
    }
  }

  const { count } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true });

  console.log(`\nTerminé. ${count} chunk(s) en base.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
