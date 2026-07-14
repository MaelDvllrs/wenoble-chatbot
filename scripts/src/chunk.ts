/**
 * Étape 1 de l'ingestion : produire les chunks.
 *
 *   npm run chunk --workspace scripts
 *
 * Crawle le site (SITE_BASE_URL), lit les PDF du brandbook (BRANDBOOK_DIR),
 * découpe le tout en chunks et écrit le résultat dans .cache/chunks.json.
 *
 * Ce script n'appelle NI Voyage NI Supabase : il ne consomme aucun token et
 * n'écrit rien en base. C'est `embed.ts` qui prendra le relais. On peut donc
 * le relancer autant de fois qu'on veut pour vérifier le découpage.
 */
import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { discoverUrls, fetchPage } from './lib/crawl.js';
import { listPdfs, readPdf } from './lib/pdf.js';
import { hashContent, splitText } from './lib/chunker.js';
import type { Chunk } from './types.js';

const SITE_BASE_URL = process.env.SITE_BASE_URL;

/** Motif identifiant les pages de blog, taguées `blog` plutôt que `site`. */
const BLOG_PATTERN = new RegExp(process.env.BLOG_URL_PATTERN ?? '^/blog/');
// Accepte un fichier .pdf ou un dossier (parcouru en récursif).
const BRANDBOOK_DIR = process.env.BRANDBOOK_DIR ?? './content';
const OUTPUT = '.cache/chunks.json';

async function chunkSite(baseUrl: string): Promise<Chunk[]> {
  console.log(`\n→ Crawl de ${baseUrl}`);
  const urls = await discoverUrls(baseUrl);

  if (urls.length === 0) {
    console.warn('  Aucune URL trouvée (ni sitemap.xml, ni liens internes).');
    return [];
  }
  console.log(`  ${urls.length} page(s) à traiter`);

  const chunks: Chunk[] = [];

  for (const url of urls) {
    const page = await fetchPage(url);
    if (!page) {
      console.warn(`  ✗ ${url} (illisible)`);
      continue;
    }

    const parts = splitText(page.text);
    const pathname = new URL(url).pathname;
    const type = BLOG_PATTERN.test(pathname) ? 'blog' : 'site';

    parts.forEach((content, index) => {
      chunks.push({
        source: `${type}:${pathname}`,
        content,
        hash: hashContent(content),
        metadata: { type, title: page.title, url, index },
      });
    });

    console.log(`  ✓ [${type}] ${pathname} — ${parts.length} chunk(s)`);
  }

  return chunks;
}

async function chunkBrandbook(dir: string): Promise<Chunk[]> {
  console.log(`\n→ Brandbook : ${dir}`);
  const files = await listPdfs(dir);

  if (files.length === 0) {
    console.warn('  Aucun PDF trouvé — étape ignorée.');
    return [];
  }

  const chunks: Chunk[] = [];

  for (const file of files) {
    const pages = await readPdf(file);
    const name = path.basename(file);
    let count = 0;

    for (const page of pages) {
      // Chaque page est découpée séparément : on garde ainsi le numéro de page
      // dans `source`, ce qui permettra de citer la source dans les réponses.
      splitText(page.text).forEach((content, index) => {
        chunks.push({
          source: `brandbook:${name}#p${page.page}`,
          content,
          hash: hashContent(content),
          metadata: { type: 'brandbook', file: name, page: page.page, index },
        });
        count++;
      });
    }

    console.log(`  ✓ ${name} — ${pages.length} page(s), ${count} chunk(s)`);
  }

  return chunks;
}

async function main() {
  if (!SITE_BASE_URL) {
    console.error('SITE_BASE_URL manquant dans scripts/.env (voir .env.example)');
    process.exit(1);
  }

  const raw = [...(await chunkSite(SITE_BASE_URL)), ...(await chunkBrandbook(BRANDBOOK_DIR))];

  if (raw.length === 0) {
    console.error('\nAucun chunk produit. Rien à écrire.');
    process.exit(1);
  }

  // Déduplication par hash de contenu. Un même texte publié sous deux URLs
  // (article dupliqué, page canonique + alias) produirait sinon deux vecteurs
  // identiques : on paierait l'embedding deux fois et la recherche remonterait
  // deux fois le même passage, au détriment des autres résultats.
  const seen = new Map<string, Chunk>();
  for (const chunk of raw) {
    if (!seen.has(chunk.hash)) seen.set(chunk.hash, chunk);
  }
  const chunks = [...seen.values()];
  const duplicates = raw.length - chunks.length;
  if (duplicates > 0) {
    console.log(`\n${duplicates} chunk(s) en doublon exact supprimé(s).`);
  }

  await mkdir(path.dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, JSON.stringify(chunks, null, 2), 'utf8');

  const chars = chunks.reduce((sum, c) => sum + c.content.length, 0);
  const count = (type: string) => chunks.filter((c) => c.metadata.type === type).length;

  console.log(`\n${chunks.length} chunk(s) écrits dans ${OUTPUT}`);
  console.log(
    `  site: ${count('site')}  |  blog: ${count('blog')}  |  brandbook: ${count('brandbook')}`,
  );
  console.log(`  ${chars.toLocaleString('fr-FR')} caractères, soit ~${Math.round(chars / 4).toLocaleString('fr-FR')} tokens à embedder`);
  console.log('\nRelis .cache/chunks.json avant de lancer `npm run embed`.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
