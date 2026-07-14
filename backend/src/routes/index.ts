import type { FastifyPluginAsync } from 'fastify';
import { healthRoutes } from './health.js';
import { chatRoutes } from './chat.js';
import { historyRoutes } from './history.js';

// TODO: routes admin (GET /conversations, GET /leads) + captation de leads.
export const registerRoutes: FastifyPluginAsync = async (app) => {
  await app.register(healthRoutes);
  await app.register(chatRoutes);
  await app.register(historyRoutes);
};
