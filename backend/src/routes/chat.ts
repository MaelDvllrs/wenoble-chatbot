import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { env } from '../lib/env.js';
import { getOrCreateSession } from '../lib/session.js';
import { chat } from '../services/chat.service.js';
import { countMessages } from '../services/conversations.service.js';

// `sessionId` n'est plus accepté du client : il vient du cookie signé.
const bodySchema = z.object({
  message: z.string().min(1).max(2000),
});

export const chatRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    '/chat',
    {
      config: {
        rateLimit: {
          max: env.RATE_LIMIT_MAX,
          timeWindow: env.RATE_LIMIT_WINDOW,
        },
      },
    },
    async (request, reply) => {
      const parsed = bodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Requête invalide', details: parsed.error.issues });
      }

      // Émis et signé par le serveur. `setCookie` n'est renseigné que pour une
      // nouvelle session ; il est écrit à la main dans writeHead() plus bas.
      const { sessionId, setCookie } = getOrCreateSession(request);

      // Deuxième garde-fou, complémentaire de la limitation par IP : celle-ci
      // borne la cadence, celle-là borne le total. Sans elle, un visiteur
      // patient pourrait discuter indéfiniment et faire grimper la facture.
      const used = await countMessages(sessionId);
      if (used >= env.MAX_MESSAGES_PER_CONVERSATION) {
        return reply.code(429).send({
          error: 'Cette conversation a atteint sa limite. Contactez-nous directement.',
        });
      }

      // On répond en Server-Sent Events : le texte part au fur et à mesure que
      // le modèle le génère, au lieu d'attendre la réponse complète.
      //
      // En écrivant directement dans reply.raw, on court-circuite Fastify : les
      // en-têtes qu'il a préparés (notamment CORS) ne partiraient pas, et le
      // navigateur bloquerait la réponse. On les recopie donc explicitement.
      const inherited: Record<string, number | string | string[]> = {};
      for (const [key, value] of Object.entries(reply.getHeaders())) {
        if (value !== undefined) inherited[key] = value;
      }

      // Le cookie, lui, ne peut pas venir de reply.getHeaders() : @fastify/cookie
      // le pose dans un hook `onSend` que reply.hijack() n'exécute jamais.
      if (setCookie) inherited['set-cookie'] = setCookie;

      reply.raw.writeHead(200, {
        ...inherited,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        // Sans ça, un reverse proxy (nginx) bufferise et le streaming est perdu.
        'X-Accel-Buffering': 'no',
      });

      // Fastify ne doit plus tenter d'envoyer de réponse : on a la main.
      reply.hijack();

      const send = (data: unknown) => reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);

      try {
        const { conversationId, stream } = await chat(sessionId, parsed.data.message);
        send({ type: 'start', conversationId });

        for await (const delta of stream) {
          send({ type: 'delta', text: delta });
        }

        send({ type: 'done' });
      } catch (err) {
        // Les en-têtes sont déjà envoyés : impossible de renvoyer un code HTTP
        // d'erreur ici. On signale l'échec dans le flux, et le widget l'affiche.
        request.log.error({ err }, 'Échec du tour de conversation');
        send({ type: 'error', message: 'Une erreur est survenue. Réessayez dans un instant.' });
      } finally {
        reply.raw.end();
      }
    },
  );
};
