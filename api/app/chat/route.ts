import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { env } from '@/lib/env';
import { corsHeaders, preflight } from '@/lib/cors';
import { getOrCreateSession } from '@/lib/session';
import { allowRequest, clientIp } from '@/lib/ratelimit';
import { chat } from '@/services/chat';
import { countMessages } from '@/services/conversations';

// Node (et non Edge) : le code utilise node:crypto et le SDK Anthropic.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Plafond Vercel. Une réponse prend ~10 s ; 60 s laisse une marge confortable
// sans jamais laisser une requête pendre indéfiniment.
export const maxDuration = 60;

// `sessionId` n'est pas accepté du client : il vient du cookie signé.
const bodySchema = z.object({
  message: z.string().min(1).max(2000),
});

export async function OPTIONS(request: NextRequest) {
  return preflight(request);
}

export async function POST(request: NextRequest) {
  const cors = corsHeaders(request.headers.get('origin'));
  const json = (body: unknown, status: number) =>
    Response.json(body, { status, headers: cors });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return json({ error: 'Requête invalide' }, 400);
  }

  // Débit par IP. Compté en base : en serverless, un compteur en mémoire ne
  // serait partagé par personne (cf. lib/ratelimit.ts).
  if (!(await allowRequest(`chat:${clientIp(request)}`))) {
    return json({ error: 'Trop de messages. Réessaie dans quelques minutes.' }, 429);
  }

  const { sessionId, setCookie } = getOrCreateSession(request);

  // Second garde-fou, complémentaire : la limite par IP borne la cadence,
  // celle-ci borne le total. Sans elle, un visiteur patient pourrait discuter
  // indéfiniment et faire grimper la facture.
  if ((await countMessages(sessionId)) >= env.MAX_MESSAGES_PER_CONVERSATION) {
    return json(
      { error: 'Cette conversation a atteint sa limite. Contacte-nous directement.' },
      429,
    );
  }

  const encoder = new TextEncoder();
  const send = (controller: ReadableStreamDefaultController, data: unknown) =>
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const { conversationId, stream } = await chat(sessionId, parsed.data.message);
        send(controller, { type: 'start', conversationId });

        for await (const delta of stream) {
          send(controller, { type: 'delta', text: delta });
        }

        send(controller, { type: 'done' });
      } catch (err) {
        // Le flux a déjà commencé : impossible de renvoyer un code HTTP
        // d'erreur. On signale l'échec dans le flux, et le widget l'affiche.
        console.error('[chat]', err);
        send(controller, { type: 'error', message: 'Une erreur est survenue. Réessaie.' });
      } finally {
        controller.close();
      }
    },
  });

  const headers = new Headers(cors);
  headers.set('Content-Type', 'text/event-stream');
  headers.set('Cache-Control', 'no-cache, no-transform');
  headers.set('Connection', 'keep-alive');
  if (setCookie) headers.append('Set-Cookie', setCookie);

  return new Response(stream, { headers });
}
