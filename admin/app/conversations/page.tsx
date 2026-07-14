import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

interface Row {
  id: string;
  session_id: string;
  status: string;
  created_at: string;
  messages: { count: number }[];
}

export default async function ConversationsPage() {
  const supabase = await createClient();

  // `messages(count)` : Supabase agrège côté base. Charger tous les messages
  // pour les compter ici ramènerait des milliers de lignes pour rien.
  const { data, error } = await supabase
    .from('conversations')
    .select('id, session_id, status, created_at, messages(count)')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-sm text-red-600">Erreur de chargement : {error.message}</p>
      </main>
    );
  }

  const rows = (data ?? []) as Row[];

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-xl font-semibold">Conversations</h1>
      <p className="mt-1 text-sm text-neutral-500">{rows.length} conversation(s), les plus récentes d’abord.</p>

      {rows.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
          Aucune conversation pour l’instant.
        </p>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5 font-medium">Session</th>
                <th className="px-4 py-2.5 font-medium">Messages</th>
                <th className="px-4 py-2.5 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <Link href={`/conversations/${row.id}`} className="text-violet-700 hover:underline">
                      {formatDate(row.created_at)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-neutral-500">
                    {row.session_id.slice(0, 8)}…
                  </td>
                  <td className="px-4 py-3 text-neutral-700">{row.messages?.[0]?.count ?? 0}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
