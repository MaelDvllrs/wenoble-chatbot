import type { NextRequest } from 'next/server';
import { supabase } from './clients';
import { env } from './env';

/**
 * Limitation de débit, comptée en base.
 *
 * En serverless, un compteur en mémoire ne protège rien : chaque requête peut
 * atterrir sur une instance neuve, avec un compteur vierge. Le décompte doit
 * donc vivre dans un stockage partagé — ici, une fonction SQL atomique
 * (check_rate_limit, cf. migration 20260714010000).
 */
export async function allowRequest(key: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_rate_limit', {
    p_key: key,
    p_max: env.RATE_LIMIT_MAX,
    p_window_seconds: env.RATE_LIMIT_WINDOW_SECONDS,
  });

  if (error) {
    // Base injoignable : on laisse passer plutôt que de bloquer tout le monde.
    // Le chat échouerait de toute façon juste après, faute de base.
    console.error('[ratelimit]', error.message);
    return true;
  }

  return data === true;
}

/**
 * IP du visiteur.
 *
 * Sur Vercel, la requête arrive toujours via le proxy de la plateforme : l'IP
 * réelle est dans x-forwarded-for. Sans ça, tous les visiteurs partageraient le
 * même compteur et le premier consommerait le quota de tous les autres.
 */
export function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}
