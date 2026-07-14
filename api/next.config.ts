import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const here = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  /**
   * Racine du traçage = ce dossier (api/), et rien au-dessus.
   *
   * Pointer vers le parent faisait échouer le déploiement : sur Vercel, seul
   * `api/` est envoyé, donc `..` désigne un dossier HORS du projet. Next
   * générait alors des chemins imbriqués et Vercel cherchait `.next` dans
   * `path0/path0` (ENOENT sur routes-manifest.json).
   *
   * En local, ce réglage fait aussi taire l'avertissement « multiple lockfiles »
   * dû au monorepo.
   */
  outputFileTracingRoot: here,

  /**
   * Le system prompt est un .md lu au runtime avec `fs`.
   *
   * Next ne trace que les fichiers qu'il voit importés : sans cette directive,
   * prompts/system.md ne serait PAS embarqué dans le bundle serverless, et la
   * route /chat planterait en production avec un ENOENT — alors que tout
   * fonctionne en local.
   */
  outputFileTracingIncludes: {
    '/**': ['./prompts/**'],
  },
};

export default nextConfig;
