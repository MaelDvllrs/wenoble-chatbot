import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

// Ces chiffres changent à chaque message : jamais de cache.
export const dynamic = 'force-dynamic';

function Stat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-neutral-200 bg-white p-5 transition hover:border-violet-300"
    >
      <p className="text-sm text-neutral-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-neutral-900">{value}</p>
    </Link>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();

  // head: true → on ne récupère aucune ligne, uniquement le compte.
  const [conversations, messages, leads] = await Promise.all([
    supabase.from('conversations').select('*', { count: 'exact', head: true }),
    supabase.from('messages').select('*', { count: 'exact', head: true }),
    supabase.from('leads').select('*', { count: 'exact', head: true }),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-xl font-semibold">Tableau de bord</h1>
      <p className="mt-1 text-sm text-neutral-500">Activité du chatbot Wenoble.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Conversations" value={conversations.count ?? 0} href="/conversations" />
        <Stat label="Messages" value={messages.count ?? 0} href="/conversations" />
        <Stat label="Leads captés" value={leads.count ?? 0} href="/leads" />
      </div>
    </main>
  );
}
