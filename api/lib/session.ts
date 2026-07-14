import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { env } from './env';

const COOKIE_NAME = 'wn_sid';

/** 30 jours : le visiteur retrouve sa conversation s'il revient. */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/**
 * Signature du cookie de session.
 *
 * On n'a plus @fastify/cookie : on signe à la main, en HMAC-SHA256. Le format
 * est `<uuid>.<signature>`. La signature empêche un visiteur de forger un
 * identifiant pour lire la conversation d'un autre.
 */
function sign(value: string): string {
  const mac = createHmac('sha256', env.COOKIE_SECRET).update(value).digest('base64url');
  return `${value}.${mac}`;
}

function unsign(signed: string): string | null {
  const index = signed.lastIndexOf('.');
  if (index < 0) return null;

  const value = signed.slice(0, index);
  const received = Buffer.from(signed.slice(index + 1));
  const expected = Buffer.from(
    createHmac('sha256', env.COOKIE_SECRET).update(value).digest('base64url'),
  );

  // Comparaison à temps constant : un `===` fuiterait, par sa durée, le nombre
  // de caractères corrects, ce qui permet de reconstituer une signature valide.
  if (received.length !== expected.length) return null;
  if (!timingSafeEqual(received, expected)) return null;

  return value;
}

export interface Session {
  sessionId: string;
  /** En-tête Set-Cookie à écrire, ou undefined si la session existait déjà. */
  setCookie?: string;
}

/** Lit la session existante, sans jamais en créer. */
export function readSession(request: NextRequest): string | null {
  const raw = request.cookies.get(COOKIE_NAME)?.value;
  return raw ? unsign(raw) : null;
}

/**
 * Identifiant de session, émis et signé par le SERVEUR.
 *
 * Le client ne choisit jamais son identité : l'identifiant est un UUID v4
 * généré ici, transporté dans un cookie `httpOnly` (donc illisible par le JS de
 * la page, hors de portée d'une XSS) et signé (donc infalsifiable).
 */
export function getOrCreateSession(request: NextRequest): Session {
  const existing = readSession(request);
  if (existing) return { sessionId: existing };

  const sessionId = randomUUID();

  const attributes = [
    `${COOKIE_NAME}=${sign(sessionId)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${MAX_AGE_SECONDS}`,
    `SameSite=${env.COOKIE_SAMESITE === 'none' ? 'None' : env.COOKIE_SAMESITE === 'strict' ? 'Strict' : 'Lax'}`,
  ];

  // `Secure` en production : le cookie ne part alors qu'en HTTPS.
  // SameSite=None l'impose de toute façon.
  if (env.isProd || env.COOKIE_SAMESITE === 'none') attributes.push('Secure');

  return { sessionId, setCookie: attributes.join('; ') };
}
