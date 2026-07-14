import type Anthropic from '@anthropic-ai/sdk';
import { anthropic, CHAT_MODEL, MAX_TOKENS } from '../lib/clients';
import { getSystemPrompt } from '../lib/prompt';
import { getSitemap } from '../lib/sitemap';
import { formatContext, retrieve } from './rag';
import { getOrCreateConversation, loadHistory, saveMessage } from './conversations';

export interface ChatResult {
  conversationId: string;
  stream: AsyncGenerator<string>;
}

/**
 * Supprime les tirets cadratins et demi-cadratins.
 *
 * L'instruction existe dans le system prompt, mais le modèle ne la respecte pas
 * de façon fiable. Une règle typographique est de toute façon mieux appliquée
 * par du code : c'est garanti, immédiat, et ça ne coûte pas un token.
 */
function stripDashes(text: string): string {
  return text.replace(/\s*[—–]\s*/g, ', ');
}

export async function chat(sessionId: string, question: string): Promise<ChatResult> {
  const conversationId = await getOrCreateConversation(sessionId);

  // L'historique est chargé AVANT d'enregistrer la question courante : sinon
  // elle apparaîtrait deux fois dans le prompt (dans l'historique ET dans le
  // dernier tour utilisateur).
  const history = await loadHistory(conversationId);
  await saveMessage(conversationId, 'user', question);

  const [matches, sitemap] = await Promise.all([retrieve(question), getSitemap()]);
  const context = formatContext(matches);

  const contextBlock = context
    ? context
    : "Aucun extrait pertinent n'a été trouvé dans le contenu de Wenoble.";

  // Rappel placé en TOUT DERNIER, après la question : c'est la position la plus
  // suivie par le modèle. Les mêmes consignes existent dans le system prompt,
  // mais elles y sont bien moins appliquées depuis le milieu d'un long prompt.
  const reminder = [
    '<consigne>',
    'COURT : 60 mots maximum, 2 ou 3 phrases, un seul paragraphe, un seul argument.',
    'Pas de liste à puces, pas de titres Markdown, pas de tirets cadratins. Tutoie.',
    'Ton CHALEUREUX et humain : écris comme on parle, sois du côté du visiteur.',
    'Court ne veut pas dire sec. Mais aucune flatterie creuse ni enthousiasme forcé.',
    "1) Donne D'ABORD l'info factuelle demandée, précise : sur un prix, la fourchette",
    'avec ses DEUX bornes (entre X et Y), jamais un vague « à partir de X ».',
    "2) Puis réponds à l'intention : vends le RÉSULTAT pour le visiteur, pas la",
    'technique. Pas de détail des packs, des options ni des livrables.',
    "Si le visiteur montre un signal d'intérêt (prix, délai, méthode, projet, besoin),",
    'termine en lui demandant son email, en une phrase. Sinon, une seule phrase de',
    'relance. Jamais deux questions.',
    '</consigne>',
  ].join('\n');

  // Le contexte RAG change à chaque question : il va dans le DERNIER tour
  // utilisateur, jamais dans le system prompt, dont la moindre modification
  // invaliderait le préfixe mis en cache par l'API.
  const userTurn = `${contextBlock}\n\nQuestion du visiteur : ${question}\n\n${reminder}`;

  const messages: Anthropic.MessageParam[] = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: userTurn },
  ];

  const stream = anthropic.messages.stream({
    model: CHAT_MODEL,
    max_tokens: MAX_TOKENS,
    // Sur Sonnet 5, OMETTRE ce paramètre active la réflexion adaptative par
    // défaut : le modèle réfléchirait avant chaque réponse, ajoutant latence et
    // tokens pour une tâche qui n'en a pas besoin.
    thinking: { type: 'disabled' },
    system: [
      {
        type: 'text',
        // Le sitemap est identique à chaque appel : il appartient donc au
        // préfixe cachable. Le mettre dans le tour utilisateur le ferait
        // repayer plein tarif à chaque question.
        text: `${getSystemPrompt()}\n\n${sitemap}`,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages,
  });

  return { conversationId, stream: relay(stream, conversationId) };
}

async function* relay(
  stream: ReturnType<typeof anthropic.messages.stream>,
  conversationId: string,
): AsyncGenerator<string> {
  let full = '';

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      const text = stripDashes(event.delta.text);
      full += text;
      yield text;
    }
  }

  // finalMessage() lève si le flux a échoué : on n'enregistre donc jamais une
  // réponse tronquée comme si elle était complète.
  await stream.finalMessage();

  if (full.trim()) {
    await saveMessage(conversationId, 'assistant', full);
  }
}
