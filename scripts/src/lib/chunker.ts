import { createHash } from 'node:crypto';

/**
 * Découpage en chunks.
 *
 * Les tailles sont exprimées en caractères, pas en tokens : c'est une
 * approximation (~4 caractères par token en français) qui évite de dépendre
 * d'un tokenizer. Le but n'est pas d'être exact, mais de produire des chunks
 * assez gros pour porter du sens et assez petits pour rester précis à la
 * recherche.
 */
export const MAX_CHARS = 1800; // ≈ 450 tokens
export const MIN_CHARS = 120; // en dessous, le chunk n'apporte rien
export const OVERLAP_CHARS = 200; // recouvrement : évite de couper une idée en deux

export function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/** Normalise les espaces et supprime les lignes vides multiples. */
export function normalize(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();
}

/**
 * Découpe un texte en respectant les frontières naturelles :
 * paragraphes d'abord, puis phrases si un paragraphe dépasse MAX_CHARS.
 * On ne coupe jamais au milieu d'un mot.
 */
export function splitText(input: string): string[] {
  const text = normalize(input);
  if (!text) return [];

  const paragraphs = text.split(/\n{2,}/).filter(Boolean);
  const chunks: string[] = [];
  let current = '';

  const flush = () => {
    const trimmed = current.trim();
    if (trimmed.length >= MIN_CHARS) chunks.push(trimmed);
    else if (trimmed && chunks.length > 0) {
      // Trop court pour vivre seul : on le recolle au chunk précédent.
      chunks[chunks.length - 1] += '\n\n' + trimmed;
    }
    current = '';
  };

  for (const paragraph of paragraphs) {
    // Paragraphe monstrueux : on le redécoupe en phrases.
    const pieces = paragraph.length > MAX_CHARS ? splitSentences(paragraph) : [paragraph];

    for (const piece of pieces) {
      if (current && current.length + piece.length + 2 > MAX_CHARS) {
        const tail = current.slice(-OVERLAP_CHARS);
        flush();
        // Le recouvrement reprend au début d'un mot.
        current = tail.slice(tail.indexOf(' ') + 1).trim();
      }
      current = current ? current + '\n\n' + piece : piece;
    }
  }

  flush();
  return chunks;
}

/** Découpe un paragraphe trop long en morceaux ≤ MAX_CHARS, aux frontières de phrase. */
function splitSentences(paragraph: string): string[] {
  const sentences = paragraph.split(/(?<=[.!?…])\s+/);
  const pieces: string[] = [];
  let buffer = '';

  for (const sentence of sentences) {
    if (buffer && buffer.length + sentence.length + 1 > MAX_CHARS) {
      pieces.push(buffer.trim());
      buffer = '';
    }
    // Phrase seule plus longue que MAX_CHARS (listes, tableaux collés…) :
    // découpe brute, mais sur des frontières de mot.
    if (sentence.length > MAX_CHARS) {
      const words = sentence.split(' ');
      for (const word of words) {
        if (buffer.length + word.length + 1 > MAX_CHARS) {
          pieces.push(buffer.trim());
          buffer = '';
        }
        buffer = buffer ? buffer + ' ' + word : word;
      }
      continue;
    }
    buffer = buffer ? buffer + ' ' + sentence : sentence;
  }

  if (buffer.trim()) pieces.push(buffer.trim());
  return pieces;
}
