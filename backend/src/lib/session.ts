import { randomUUID } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import { env } from './env.js';

const COOKIE_NAME = 'wn_sid';

/** 30 jours : le visiteur retrouve sa conversation s'il revient. */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export interface Session {
  sessionId: string;
  /**
   * En-tête Set-Cookie à écrire, ou undefined si la session existait déjà.
   *
   * On NE passe PAS par reply.setCookie() : ce plugin pose le cookie dans un
   * hook `onSend`, que reply.hijack() (nécessaire au streaming SSE) court-circuite.
   * Le cookie ne partirait alors jamais. On sérialise donc l'en-tête à la main
   * pour l'écrire directement dans writeHead().
   */
  setCookie?: string;
}

/**
 * Identifiant de session, émis et signé par le SERVEUR.
 *
 * Auparavant le widget générait lui-même son `sessionId` et l'envoyait dans le
 * corps de la requête : n'importe qui pouvait donc en soumettre un autre et lire
 * la conversation d'un tiers. Désormais :
 *
 *   - l'identifiant est un UUID v4 généré côté serveur (non devinable) ;
 *   - il voyage dans un cookie `httpOnly` : le JS de la page ne peut pas le lire,
 *     ce qui le met hors de portée d'une injection XSS sur le site ;
 *   - il est signé : toute valeur trafiquée est rejetée.
 *
 * Le client ne choisit donc plus jamais son identité.
 */
/**
 * Lit la session existante, sans jamais en créer.
 *
 * Utilisé par les routes en lecture seule (GET /history) : créer une session
 * pour un visiteur qui n'a encore rien demandé polluerait la base de sessions
 * vides et poserait un cookie sans raison.
 */
export function readSession(request: FastifyRequest): string | null {
  const raw = request.cookies[COOKIE_NAME];
  if (!raw) return null;

  const result = request.unsignCookie(raw);
  return result.valid && result.value ? result.value : null;
}

export function getOrCreateSession(request: FastifyRequest): Session {
  const existing = readSession(request);
  if (existing) return { sessionId: existing };

  if (request.cookies[COOKIE_NAME]) {
    // Cookie présent mais signature invalide : forgé, ou COOKIE_SECRET changé.
    // On repart d'une session neuve plutôt que de faire confiance à la valeur.
    request.log.warn('Cookie de session invalide — nouvelle session émise.');
  }

  const sessionId = randomUUID();
  const signed = request.server.signCookie(sessionId);

  const setCookie = request.server.serializeCookie(COOKIE_NAME, signed, {
    httpOnly: true,
    // `secure` en prod : le cookie ne part alors qu'en HTTPS.
    // SameSite=None l'impose de toute façon.
    secure: env.isProd || env.COOKIE_SAMESITE === 'none',
    sameSite: env.COOKIE_SAMESITE,
    domain: env.COOKIE_DOMAIN,
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });

  return { sessionId, setCookie };
}
