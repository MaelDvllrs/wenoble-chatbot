import { env } from './env';

/**
 * En-têtes CORS.
 *
 * On ne renvoie JAMAIS `*` : le widget envoie le cookie de session
 * (`credentials: 'include'`), et le navigateur refuse un joker dès qu'il y a des
 * identifiants. L'origine doit donc être renvoyée telle quelle, et uniquement si
 * elle figure dans ALLOWED_ORIGINS.
 */
export function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    Vary: 'Origin', // sans ça, un cache pourrait servir la réponse d'une autre origine
  };

  if (origin && env.allowedOrigins.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
}

/** Réponse au preflight envoyé par le navigateur avant un POST cross-origin. */
export function preflight(request: Request): Response {
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders(request.headers.get('origin')),
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}
