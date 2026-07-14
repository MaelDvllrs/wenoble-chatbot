import * as cheerio from 'cheerio';

const USER_AGENT = 'WenobleChatbotIngest/0.1 (+https://wenoble.com)';

/** Plafond de sécurité, surchargeable via MAX_PAGES. Le dépassement est signalé, jamais silencieux. */
const MAX_PAGES = Number(process.env.MAX_PAGES ?? 500);

/**
 * Motifs d'URL à ne jamais indexer (regex, séparées par des virgules dans
 * EXCLUDE_URL_PATTERNS). Utile pour sortir le blog, les mentions légales, etc.
 */
const EXCLUDE = (process.env.EXCLUDE_URL_PATTERNS ?? '')
  .split(',')
  .map((p) => p.trim())
  .filter(Boolean)
  .map((p) => new RegExp(p));

export interface Page {
  url: string;
  title: string;
  text: string;
}

async function get(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') ?? '';
    if (!type.includes('html') && !type.includes('xml')) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** Normalise une URL pour la déduplication : sans hash, sans slash final, sans query. */
function canonical(raw: string, base: string): string | null {
  try {
    const url = new URL(raw, base);
    if (url.origin !== new URL(base).origin) return null; // pas de lien externe
    if (!/^https?:$/.test(url.protocol)) return null;
    url.hash = '';
    url.search = '';
    let out = url.toString();
    if (out.endsWith('/') && url.pathname !== '/') out = out.slice(0, -1);
    return out;
  } catch {
    return null;
  }
}

/** Fichiers non-HTML qu'on ne veut jamais crawler. */
function isAsset(url: string): boolean {
  return /\.(png|jpe?g|gif|svg|webp|avif|ico|css|js|mjs|json|pdf|zip|woff2?|mp4|webm)$/i.test(url);
}

/** Lit le sitemap.xml (et les sitemaps imbriqués) s'il existe. */
async function fromSitemap(baseUrl: string): Promise<string[]> {
  const xml = await get(new URL('/sitemap.xml', baseUrl).toString());
  if (!xml) return [];

  const $ = cheerio.load(xml, { xmlMode: true });

  // Sitemap index : il pointe vers d'autres sitemaps.
  const nested = $('sitemap > loc')
    .map((_, el) => $(el).text().trim())
    .get();

  if (nested.length > 0) {
    const all: string[] = [];
    for (const child of nested) {
      const childXml = await get(child);
      if (!childXml) continue;
      const $child = cheerio.load(childXml, { xmlMode: true });
      all.push(
        ...$child('url > loc')
          .map((_, el) => $child(el).text().trim())
          .get(),
      );
    }
    return all;
  }

  return $('url > loc')
    .map((_, el) => $(el).text().trim())
    .get();
}

/** Fallback : parcours en largeur des liens internes depuis la page d'accueil. */
async function fromLinks(baseUrl: string): Promise<string[]> {
  const start = canonical(baseUrl, baseUrl);
  if (!start) return [];

  const seen = new Set<string>([start]);
  const queue = [start];
  const found: string[] = [];

  while (queue.length > 0 && found.length < MAX_PAGES) {
    const url = queue.shift()!;
    const html = await get(url);
    if (!html) continue;
    found.push(url);

    const $ = cheerio.load(html);
    for (const el of $('a[href]').get()) {
      const next = canonical($(el).attr('href')!, baseUrl);
      if (!next || seen.has(next) || isAsset(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }

  return found;
}

/** Liste les URLs à indexer : sitemap si disponible, sinon crawl des liens. */
export async function discoverUrls(baseUrl: string): Promise<string[]> {
  const sitemap = await fromSitemap(baseUrl);
  const urls = sitemap.length > 0 ? sitemap : await fromLinks(baseUrl);

  const unique = new Set<string>();
  let excluded = 0;

  for (const url of urls) {
    const c = canonical(url, baseUrl);
    if (!c || isAsset(c)) continue;
    if (EXCLUDE.some((re) => re.test(c))) {
      excluded++;
      continue;
    }
    unique.add(c);
  }

  const all = [...unique];
  if (excluded > 0) console.log(`  ${excluded} URL(s) exclue(s) par EXCLUDE_URL_PATTERNS`);

  // Le plafond ne doit jamais tronquer sans le dire.
  if (all.length > MAX_PAGES) {
    console.warn(
      `  ⚠ ${all.length} URLs trouvées, plafonnées à ${MAX_PAGES} (MAX_PAGES). ` +
        `${all.length - MAX_PAGES} page(s) NON indexée(s) — augmente MAX_PAGES pour tout couvrir.`,
    );
  }

  return all.slice(0, MAX_PAGES);
}

/**
 * Récupère une page et en extrait le texte utile.
 * On retire tout ce qui pollue le RAG : nav, footer, scripts, cookie banners…
 * Sans ça, chaque chunk contiendrait le menu du site et la recherche
 * remonterait n'importe quoi.
 */
export async function fetchPage(url: string): Promise<Page | null> {
  const html = await get(url);
  if (!html) return null;

  const $ = cheerio.load(html);
  $('script, style, noscript, svg, nav, header, footer, form, iframe').remove();
  $('[aria-hidden="true"], [role="navigation"], [role="banner"], [role="contentinfo"]').remove();

  const title = $('title').first().text().trim() || $('h1').first().text().trim();

  // On privilégie le contenu principal s'il est identifiable.
  const root = $('main').length ? $('main') : $('article').length ? $('article') : $('body');

  // Un saut de ligne entre les blocs, sinon tout le texte se colle et le
  // découpage par paragraphes ne fonctionne plus.
  root.find('h1, h2, h3, h4, h5, h6, p, li, blockquote, td').each((_, el) => {
    $(el).append('\n\n');
  });

  const text = root.text();
  return { url, title, text };
}
