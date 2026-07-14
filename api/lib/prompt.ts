import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Le prompt vit dans un .md pour rester éditable sans toucher au code.
 *
 * Il est lu depuis le disque au premier appel. Sur Vercel, le fichier n'est
 * embarqué dans le bundle que grâce à `outputFileTracingIncludes` (next.config.ts) :
 * sans cette directive, on aurait un ENOENT en production alors que tout marche
 * en local.
 */
let cached: string | null = null;

export function getSystemPrompt(): string {
  if (!cached) {
    cached = readFileSync(path.join(process.cwd(), 'prompts/system.md'), 'utf8');
  }
  return cached;
}
