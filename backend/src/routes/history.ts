import type { FastifyPluginAsync } from 'fastify';
import { readSession } from '../lib/session.js';
import { loadDisplayHistory } from '../services/conversations.service.js';

/**
 * Restitue la conversation en cours au widget après un rechargement de page.
 *
 * La conversation vit en base, mais le widget est reconstruit à zéro à chaque
 * chargement : sans cette route, l'historique existe mais n'est jamais réaffiché.
 * La session est lue dans le cookie signé, jamais fournie par le client.
 */
export const historyRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/history',
    {
      // Plus permissif que /chat : la route ne coûte qu'une requête SQL,
      // aucun token de modèle. Mais elle reste plafonnée.
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const sessionId = readSession(request);

      // Pas de cookie (ou cookie invalide) : rien à restituer, et surtout on
      // n'émet pas de session pour un visiteur qui n'a encore rien demandé.
      if (!sessionId) return reply.send({ messages: [] });

      const messages = await loadDisplayHistory(sessionId);
      return reply.send({ messages });
    },
  );
};
