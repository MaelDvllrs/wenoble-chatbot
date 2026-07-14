import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Le prompt vit dans un .md pour rester éditable sans toucher au code.
 * En dev (tsx) on lit src/prompts ; en prod on lit dist/prompts, que le script
 * de build recopie. On tente les deux, dans cet ordre.
 */
const CANDIDATES = [
  path.join(here, '../prompts/system.md'),
  path.join(here, '../../src/prompts/system.md'),
];

function load(): string {
  for (const file of CANDIDATES) {
    try {
      return readFileSync(file, 'utf8');
    } catch {
      continue;
    }
  }
  throw new Error(`system.md introuvable. Cherché dans :\n  ${CANDIDATES.join('\n  ')}`);
}

/**
 * Lu une seule fois au démarrage : le contenu est identique à chaque requête,
 * ce qui est précisément la condition pour que le prompt caching d'Anthropic
 * fonctionne (le cache est une correspondance de préfixe, octet pour octet).
 */
export const SYSTEM_PROMPT = load();
