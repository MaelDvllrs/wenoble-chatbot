import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { env } from './env';

/**
 * Les clients sont créés PARESSEUSEMENT, au premier usage.
 *
 * Les instancier à l'import lirait les variables d'environnement pendant le
 * build de Vercel (Next exécute les modules des routes pour collecter leurs
 * métadonnées) et le ferait échouer, alors qu'aucun secret n'est censé être
 * nécessaire pour compiler.
 *
 * Le Proxy conserve l'ergonomie `supabase.from(...)` : les méthodes sont liées à
 * l'instance réelle, sinon elles perdraient leur `this`.
 */
function lazy<T extends object>(factory: () => T): T {
  let instance: T | null = null;

  return new Proxy({} as T, {
    get(_target, prop) {
      instance ??= factory();
      const value = Reflect.get(instance, prop);
      return typeof value === 'function' ? value.bind(instance) : value;
    },
  });
}

/**
 * Client Supabase avec la clé service_role : il contourne la RLS.
 * Il ne doit JAMAIS être importé depuis du code envoyé au navigateur — ici, tout
 * ce dossier ne tourne que dans des Route Handlers, côté serveur.
 */
export const supabase = lazy<SupabaseClient>(() =>
  createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  }),
);

export const anthropic = lazy<Anthropic>(() => new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }));

/** Plafond de la réponse. Une réponse de chatbot de site reste courte. */
export const MAX_TOKENS = 1024;

/** Dimension des vecteurs Voyage. Doit correspondre à documents.embedding. */
export const EMBEDDING_DIMENSIONS = 1024;
