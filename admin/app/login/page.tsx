'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      console.error('[admin] login', error.status, error.code, error.message);

      // Identifiants faux : message volontairement générique. Préciser « email
      // inconnu » ou « mot de passe incorrect » permettrait d'énumérer les
      // comptes existants.
      if (error.code === 'invalid_credentials' || error.status === 400) {
        setError('Identifiants invalides.');
      } else {
        // Toute autre erreur est un problème de CONFIGURATION (provider email
        // désactivé, email non confirmé, clé anon absente…) : la masquer ferait
        // perdre du temps. Elle ne révèle rien sur l'existence d'un compte.
        setError(`Erreur ${error.status ?? ''} : ${error.message}`);
      }

      setLoading(false);
      return;
    }

    // refresh() force les Server Components à se recharger avec la session.
    router.replace('/');
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-5 rounded-xl border border-neutral-200 bg-white p-8 shadow-sm"
      >
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">Admin Wenoble</h1>
          <p className="mt-1 text-sm text-neutral-500">Connecte-toi pour accéder au chatbot.</p>
        </div>

        <div className="space-y-3">
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-100"
          />
          <input
            type="password"
            required
            autoComplete="current-password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-100"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-violet-700 disabled:opacity-50"
        >
          {loading ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
    </main>
  );
}
