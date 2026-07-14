import { supabase } from '../lib/supabase.js';

export type Role = 'user' | 'assistant';

export interface StoredMessage {
  role: Role;
  content: string;
}

/**
 * Nombre de tours d'historique renvoyés à Claude.
 *
 * L'API est sans état : tout l'historique repart à chaque question, et il est
 * refacturé en entrée à chaque fois. Plafonner borne le coût d'une conversation
 * longue — un visiteur de site en fait rarement plus de quelques tours.
 */
const MAX_HISTORY_MESSAGES = 10;

/** Retrouve la conversation liée à une session, ou la crée. */
export async function getOrCreateConversation(sessionId: string): Promise<string> {
  const { data: existing, error: selectError } = await supabase
    .from('conversations')
    .select('id')
    .eq('session_id', sessionId)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (selectError) throw new Error(`conversations.select : ${selectError.message}`);
  if (existing) return existing.id;

  const { data: created, error: insertError } = await supabase
    .from('conversations')
    .insert({ session_id: sessionId, status: 'open' })
    .select('id')
    .single();

  if (insertError) throw new Error(`conversations.insert : ${insertError.message}`);
  return created.id;
}

/**
 * Nombre de messages restitués au widget au rechargement de la page.
 * Plus large que MAX_HISTORY_MESSAGES : afficher l'historique ne coûte rien,
 * contrairement à le renvoyer au modèle.
 */
const MAX_DISPLAYED_MESSAGES = 50;

/** Conversation ouverte d'une session, ou null. Ne crée jamais rien. */
export async function findConversation(sessionId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('conversations')
    .select('id')
    .eq('session_id', sessionId)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`conversations.select : ${error.message}`);
  return data?.id ?? null;
}

/** Historique complet à afficher dans le widget après un rechargement de page. */
export async function loadDisplayHistory(sessionId: string): Promise<StoredMessage[]> {
  const conversationId = await findConversation(sessionId);
  if (!conversationId) return [];

  const { data, error } = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .in('role', ['user', 'assistant'])
    .order('created_at', { ascending: true })
    .limit(MAX_DISPLAYED_MESSAGES);

  if (error) throw new Error(`messages.select : ${error.message}`);
  return (data ?? []) as StoredMessage[];
}

/** Charge les derniers messages d'une conversation, dans l'ordre chronologique. */
export async function loadHistory(conversationId: string): Promise<StoredMessage[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .in('role', ['user', 'assistant'])
    .order('created_at', { ascending: false })
    .limit(MAX_HISTORY_MESSAGES);

  if (error) throw new Error(`messages.select : ${error.message}`);

  // On a trié en DESC pour prendre les N plus RÉCENTS ; on remet en ordre
  // chronologique, seul ordre accepté par l'API.
  return ((data ?? []) as StoredMessage[]).reverse();
}

/**
 * Nombre de messages échangés sur la (ou les) conversation(s) d'une session.
 * Sert à plafonner ce qu'une session peut coûter, indépendamment de la
 * limitation de débit par IP.
 */
export async function countMessages(sessionId: string): Promise<number> {
  const { data: conversations, error: convError } = await supabase
    .from('conversations')
    .select('id')
    .eq('session_id', sessionId);

  if (convError) throw new Error(`conversations.select : ${convError.message}`);
  if (!conversations || conversations.length === 0) return 0;

  const { count, error } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .in(
      'conversation_id',
      conversations.map((c) => c.id),
    );

  if (error) throw new Error(`messages.count : ${error.message}`);
  return count ?? 0;
}

export async function saveMessage(
  conversationId: string,
  role: Role,
  content: string,
): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, role, content });

  if (error) throw new Error(`messages.insert : ${error.message}`);
}
