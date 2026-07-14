import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

interface Message {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: conversation }, { data: messages }, { data: leads }] = await Promise.all([
    supabase.from('conversations').select('*').eq('id', id).maybeSingle(),
    supabase
      .from('messages')
      .select('id, role, content, created_at')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true }),
    supabase.from('leads').select('email, phone, name').eq('conversation_id', id),
  ]);

  if (!conversation) notFound();

  const lead = leads?.[0];

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/conversations" className="text-sm text-neutral-500 hover:text-neutral-900">
        ← Conversations
      </Link>

      <div className="mt-4 flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">{formatDate(conversation.created_at)}</h1>
        <span className="font-mono text-xs text-neutral-400">
          {conversation.session_id.slice(0, 8)}…
        </span>
      </div>

      {lead && (
        <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm">
          <p className="font-medium text-violet-900">Lead capté</p>
          <p className="mt-1 text-violet-800">
            {[lead.name, lead.email, lead.phone].filter(Boolean).join(' · ')}
          </p>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {(messages ?? []).map((message: Message) => (
          <div
            key={message.id}
            className={
              message.role === 'user'
                ? 'ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-violet-600 px-4 py-2.5 text-sm text-white'
                : 'mr-auto max-w-[85%] rounded-2xl rounded-bl-sm bg-white px-4 py-2.5 text-sm text-neutral-800 ring-1 ring-neutral-200'
            }
          >
            {/* whitespace-pre-wrap : les sauts de ligne du modèle sont conservés. */}
            <p className="whitespace-pre-wrap">{message.content}</p>
            <p
              className={`mt-1.5 text-[11px] ${
                message.role === 'user' ? 'text-violet-200' : 'text-neutral-400'
              }`}
            >
              {formatDate(message.created_at)}
            </p>
          </div>
        ))}
      </div>

      {(messages ?? []).length === 0 && (
        <p className="mt-6 text-sm text-neutral-500">Aucun message dans cette conversation.</p>
      )}
    </main>
  );
}
