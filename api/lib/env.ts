import { z } from 'zod';

/**
 * Validation des variables d'environnement.
 *
 * Sur Vercel il n'y a pas de dotenv : les variables sont injectées par la
 * plateforme (et par .env.local en développement, que Next charge seul).
 */
const schema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  ANTHROPIC_API_KEY: z.string().min(1),
  CHAT_MODEL: z.string().default('claude-sonnet-5'),

  VOYAGE_API_KEY: z.string().min(1),
  // Doit rester le MÊME modèle que celui utilisé par scripts/embed.ts :
  // deux modèles différents produisent des vecteurs incomparables.
  VOYAGE_MODEL: z.string().default('voyage-3'),

  ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),

  // Signe le cookie de session : sans lui, un visiteur pourrait forger un
  // identifiant et lire la conversation d'un autre.
  COOKIE_SECRET: z.string().min(32, 'COOKIE_SECRET doit faire au moins 32 caractères'),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),

  RATE_LIMIT_MAX: z.coerce.number().default(20),
  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().default(300),
  MAX_MESSAGES_PER_CONVERSATION: z.coerce.number().default(40),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('Variables d’environnement invalides :', z.treeifyError(parsed.error));
  throw new Error('Configuration invalide — voir .env.example');
}

export const env = {
  ...parsed.data,
  isProd: process.env.NODE_ENV === 'production',
  allowedOrigins: parsed.data.ALLOWED_ORIGINS.split(',').map((o) => o.trim()),
};
