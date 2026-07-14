import type { NextRequest } from 'next/server';
import { corsHeaders, preflight } from '@/lib/cors';
import { readSession } from '@/lib/session';
import { loadDisplayHistory } from '@/services/conversations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  return preflight(request);
}

/**
 * Restitue la conversation en cours au widget après un rechargement de page.
 *
 * La conversation vit en base, mais le widget est reconstruit à zéro à chaque
 * chargement. La session est lue dans le cookie signé, jamais fournie par le
 * client — et cette route ne CRÉE jamais de session : un visiteur qui n'a encore
 * rien demandé ne doit pas se voir poser un cookie.
 */
export async function GET(request: NextRequest) {
  const headers = corsHeaders(request.headers.get('origin'));
  const sessionId = readSession(request);

  if (!sessionId) return Response.json({ messages: [] }, { headers });

  try {
    const messages = await loadDisplayHistory(sessionId);
    return Response.json({ messages }, { headers });
  } catch (err) {
    console.error('[history]', err);
    return Response.json({ messages: [] }, { headers });
  }
}
