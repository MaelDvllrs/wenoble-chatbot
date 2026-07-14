import Anthropic from '@anthropic-ai/sdk';
import { env } from './env.js';

export const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

/**
 * Modèle de conversation, surchargeable via CHAT_MODEL.
 *
 * Sonnet 5 par défaut : Haiku 4.5 tenait la charge côté qualité de réponse,
 * mais suivait mal les consignes de format (tirets cadratins, demande d'email,
 * relance unique). Sonnet 5 les respecte, pour un coût plus élevé mais qui reste
 * marginal au volume d'un site vitrine.
 */
export const CHAT_MODEL = env.CHAT_MODEL;

/** Plafond de la réponse. Une réponse de chatbot de site reste courte. */
export const MAX_TOKENS = 1024;

/** Dimension des embeddings Voyage (voyage-3 / voyage-3-large) — doit correspondre à vector(1024) en base. */
export const EMBEDDING_DIMENSIONS = 1024;
