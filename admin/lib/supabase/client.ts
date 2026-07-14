'use client';

import { createBrowserClient } from '@supabase/ssr';

/**
 * Client Supabase côté navigateur. Utilisé uniquement pour le login/logout.
 *
 * Il n'emploie que la clé ANON, publique par nature : c'est la RLS qui protège
 * les données, pas le secret de la clé.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
