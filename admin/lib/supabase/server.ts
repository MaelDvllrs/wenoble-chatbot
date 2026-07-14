import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Client Supabase pour les Server Components et Server Actions.
 *
 * Il porte la session de l'utilisateur connecté : toutes les requêtes passent
 * donc par la RLS. Un visiteur non authentifié ne lit rien, même s'il atteignait
 * cette page.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Appelé depuis un Server Component : Next.js interdit d'y écrire un
            // cookie. Sans gravité, c'est le middleware qui rafraîchit la session.
          }
        },
      },
    },
  );
}
