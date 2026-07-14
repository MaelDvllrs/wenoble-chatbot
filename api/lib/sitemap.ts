import { supabase } from './clients';
/* logger pino remplacé par console : pas de logger custom en serverless. */

interface Page {
  url: string;
  title: string;
  type: 'site' | 'blog' | 'brandbook';
}

/**
 * Plafond de pages listées dans le prompt. Le blog compte une centaine
 * d'articles : tout envoyer gonflerait le prompt sans servir. Au-delà, on tronque
 * ET on le signale dans les logs (jamais de troncature silencieuse).
 */
const MAX_BLOG_PAGES = 40;

/** Nettoie un titre de page : « Services | Wenoble » → « Services ». */
function cleanTitle(title: string, url: string): string {
  const cleaned = title.split(/\s[|–—]\s/)[0]?.trim();
  if (cleaned) return cleaned;
  // Pas de <title> exploitable : on retombe sur le chemin de l'URL.
  return new URL(url).pathname;
}

async function build(): Promise<string> {
  const { data, error } = await supabase
    .from('documents')
    .select('source, metadata')
    .limit(2000);

  if (error) throw new Error(`documents.select (sitemap) : ${error.message}`);

  // Une page produit plusieurs chunks : on déduplique par URL.
  const pages = new Map<string, Page>();

  for (const row of data ?? []) {
    const meta = (row.metadata ?? {}) as { url?: string; title?: string; type?: Page['type'] };
    if (!meta.url || !meta.type || meta.type === 'brandbook') continue;
    if (pages.has(meta.url)) continue;

    pages.set(meta.url, {
      url: meta.url,
      title: cleanTitle(meta.title ?? '', meta.url),
      type: meta.type,
    });
  }

  const all = [...pages.values()];
  const site = all.filter((p) => p.type === 'site');
  const blog = all.filter((p) => p.type === 'blog');

  if (blog.length > MAX_BLOG_PAGES) {
    console.warn(
      `Sitemap : ${blog.length} articles de blog, tronqué à ${MAX_BLOG_PAGES} dans le prompt.`,
    );
  }

  const format = (p: Page) => `- [${p.title}](${p.url})`;

  const sections = [
    '# Pages du site Wenoble',
    '',
    "Voici les pages réellement en ligne. Tu peux les citer en lien Markdown dans tes",
    "réponses. N'invente JAMAIS une URL : si une page n'est pas dans cette liste, elle",
    "n'existe pas.",
    '',
    '## Pages de l’agence',
    ...site.map(format),
  ];

  if (blog.length > 0) {
    sections.push('', '## Articles de blog', ...blog.slice(0, MAX_BLOG_PAGES).map(format));
  }

  return sections.join('\n');
}

let cached: Promise<string> | null = null;

/**
 * Sitemap injecté dans le system prompt.
 *
 * Construit une seule fois, au premier appel, puis mémorisé : le contenu doit
 * rester IDENTIQUE d'une requête à l'autre, sans quoi le préfixe change et le
 * prompt caching d'Anthropic ne peut jamais s'activer.
 *
 * Corollaire : après une ré-indexation (npm run embed), il faut redémarrer le
 * backend pour que les nouvelles pages apparaissent.
 */
export function getSitemap(): Promise<string> {
  if (!cached) {
    cached = build().catch((err) => {
      // Un sitemap indisponible ne doit pas casser le chat : on répond sans lui.
      console.error('Sitemap indisponible — les réponses seront sans liens.', err);
      return '';
    });
  }
  return cached;
}
