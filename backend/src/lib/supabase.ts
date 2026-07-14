import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

/**
 * Client Supabase côté serveur, avec la clé service_role.
 * Contourne les Row Level Security : ne jamais l'exposer au navigateur.
 */
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
