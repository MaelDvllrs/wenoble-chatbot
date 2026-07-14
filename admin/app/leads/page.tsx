import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

interface Lead {
  id: string;
  conversation_id: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  created_at: string;
}

export default async function LeadsPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('leads')
    .select('id, conversation_id, email, phone, name, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-sm text-red-600">Erreur de chargement : {error.message}</p>
      </main>
    );
  }

  const leads = (data ?? []) as Lead[];

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-xl font-semibold">Leads</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Coordonnées laissées par les visiteurs dans le chat.
      </p>

      {leads.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
          <p>Aucun lead pour l’instant.</p>
          <p className="mt-1 text-xs">
            La capture automatique des emails n’est pas encore branchée : le chatbot demande
            l’email, mais rien ne l’enregistre pour le moment.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5 font-medium">Nom</th>
                <th className="px-4 py-2.5 font-medium">Email</th>
                <th className="px-4 py-2.5 font-medium">Téléphone</th>
                <th className="px-4 py-2.5 font-medium">Conversation</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr
                  key={lead.id}
                  className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50"
                >
                  <td className="px-4 py-3 text-neutral-600">{formatDate(lead.created_at)}</td>
                  <td className="px-4 py-3">{lead.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    {lead.email ? (
                      <a href={`mailto:${lead.email}`} className="text-violet-700 hover:underline">
                        {lead.email}
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3">{lead.phone ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/conversations/${lead.conversation_id}`}
                      className="text-neutral-500 hover:text-neutral-900 hover:underline"
                    >
                      Voir
                    </Link>
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
