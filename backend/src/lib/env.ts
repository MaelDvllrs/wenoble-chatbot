import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  CHAT_MODEL: z.string().default('claude-sonnet-5'),
  VOYAGE_API_KEY: z.string().min(1),
  // Doit rester le MÊME modèle que celui utilisé par scripts/embed.ts :
  // deux modèles différents produisent des vecteurs incomparables.
  VOYAGE_MODEL: z.string().default('voyage-3'),
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),

  // Signe le cookie de session : sans lui, un visiteur pourrait forger un
  // identifiant et lire la conversation d'un autre.
  COOKIE_SECRET: z.string().min(32, 'COOKIE_SECRET doit faire au moins 32 caractères'),
  // `lax` si le widget et l'API partagent le même domaine racine
  // (wenoble.com + api.wenoble.com). `none` si l'API est sur un domaine
  // totalement différent — impose alors HTTPS.
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  COOKIE_DOMAIN: z.string().optional(),

  // Limitation de débit sur /chat, par IP.
  RATE_LIMIT_MAX: z.coerce.number().default(20),
  RATE_LIMIT_WINDOW: z.string().default('5 minutes'),
  // Plafond de messages par conversation : borne ce qu'une seule session peut
  // coûter, même en restant sous la limite de débit.
  MAX_MESSAGES_PER_CONVERSATION: z.coerce.number().default(40),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('Variables d\'environnement invalides :');
  console.error(z.treeifyError(parsed.error));
  process.exit(1);
}

export const env = {
  ...parsed.data,
  allowedOrigins: parsed.data.ALLOWED_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  isProd: parsed.data.NODE_ENV === 'production',
};
