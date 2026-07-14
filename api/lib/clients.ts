import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { env } from './env';

/**
 * Client Supabase avec la clé service_role : il contourne la RLS.
 * Il ne doit JAMAIS être importé depuis du code envoyé au navigateur — ici,
 * tout ce dossier ne tourne que dans des Route Handlers, côté serveur.
 */
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

export const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

export const CHAT_MODEL = env.CHAT_MODEL;

/** Plafond de la réponse. Une réponse de chatbot de site reste courte. */
export const MAX_TOKENS = 1024;

/** Dimension des vecteurs Voyage. Doit correspondre à documents.embedding. */
export const EMBEDDING_DIMENSIONS = 1024;
