import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { env } from './lib/env.js';
import { logger } from './lib/logger.js';
import { registerRoutes } from './routes/index.js';

const app = Fastify({
  loggerInstance: logger,
  // Derrière nginx sur le VPS, l'IP vue par Fastify est celle du proxy
  // (127.0.0.1) : sans ceci, la limitation de débit compterait tous les
  // visiteurs comme un seul et unique client.
  trustProxy: env.isProd,
});

await app.register(cookie, {
  secret: env.COOKIE_SECRET, // signe le cookie de session
});

await app.register(cors, {
  // Seules les origines listées dans ALLOWED_ORIGINS peuvent appeler l'API.
  // Les requêtes sans Origin (curl, healthcheck du VPS) sont autorisées.
  origin: (origin, cb) => {
    if (!origin || env.allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`Origine non autorisée : ${origin}`), false);
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  // Indispensable pour que le navigateur envoie ET accepte le cookie de session
  // depuis une autre origine.
  credentials: true,
});

// Limitation de débit. Elle n'est PAS globale : elle est appliquée route par
// route (voir routes/chat.ts), pour ne pas plafonner le healthcheck.
await app.register(rateLimit, { global: false });

/**
 * Le backend sert aussi les fichiers du widget (widget.js, widget.css).
 *
 * Les héberger ici plutôt qu'ailleurs évite une seconde origine à configurer :
 * le site charge le script depuis ask-ai.wenoble.fr, qui est déjà l'API.
 *
 * Le chemin est résolu depuis ce fichier : il vaut backend/src/../../widget en
 * dev (tsx) comme backend/dist/../../widget en prod (build).
 */
const widgetDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../widget');

await app.register(fastifyStatic, {
  root: widgetDir,
  prefix: '/widget/',
  // Les assets changent à chaque déploiement : un cache long obligerait les
  // visiteurs à vider le leur pour voir une correction. 5 min est un compromis.
  cacheControl: true,
  maxAge: '5m',
});

await app.register(registerRoutes);

try {
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    await app.close();
    process.exit(0);
  });
}
