import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { signOut } from './actions';

/**
 * Barre de navigation. Rendue côté serveur : elle n'apparaît que si une session
 * existe, et affiche l'email du compte connecté.
 */
export default async function Nav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <nav className="flex items-center gap-5 text-sm">
          <Link href="/" className="font-semibold text-neutral-900">
            Wenoble
          </Link>
          <Link href="/conversations" className="text-neutral-600 hover:text-neutral-900">
            Conversations
          </Link>
          <Link href="/leads" className="text-neutral-600 hover:text-neutral-900">
            Leads
          </Link>
        </nav>

        <div className="flex items-center gap-3 text-sm">
          <span className="text-neutral-500">{user.email}</span>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs text-neutral-700 transition hover:bg-neutral-100"
            >
              Déconnexion
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
