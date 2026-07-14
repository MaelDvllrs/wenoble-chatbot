import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /**
   * Racine du monorepo. Sans ça, Next remonte trop haut (il trouve un autre
   * package-lock.json sur la machine) et trace les fichiers depuis le mauvais
   * dossier.
   */
  outputFileTracingRoot: path.join(process.cwd(), '..'),

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
