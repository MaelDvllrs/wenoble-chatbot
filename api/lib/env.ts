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

type Env = z.infer<typeof schema> & {
  isProd: boolean;
  allowedOrigins: string[];
};

let cached: Env | null = null;

function load(): Env {
  const parsed = schema.safeParse(process.env);

  if (!parsed.success) {
    // Les noms des variables fautives sont inclus dans le message : sans eux, on
    // ne voit qu'un « Configuration invalide » opaque dans les logs Vercel, et
    // il faut deviner laquelle manque. On ne logue JAMAIS les valeurs.
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')} (${issue.message})`)
      .join(', ');

    throw new Error(`Variables d'environnement invalides ou manquantes : ${details}`);
  }

  return {
    ...parsed.data,
    isProd: process.env.NODE_ENV === 'production',
    allowedOrigins: parsed.data.ALLOWED_ORIGINS.split(',').map((o) => o.trim()),
  };
}

/**
 * Validation PARESSEUSE : elle ne se déclenche qu'au premier accès, donc à la
 * première requête, jamais à l'import du module.
 *
 * Valider au chargement faisait échouer le build Vercel : Next exécute les
 * modules des routes pour collecter leurs métadonnées (« Failed to collect page
 * data »), à un moment où les variables d'exécution ne sont pas nécessairement
 * là. Un build ne doit pas dépendre de secrets de runtime.
 *
 * Le Proxy permet de garder `env.MA_VAR` partout, sans changer les appelants.
 */
export const env: Env = new Proxy({} as Env, {
  get(_target, prop) {
    cached ??= load();
    return cached[prop as keyof Env];
  },
});
