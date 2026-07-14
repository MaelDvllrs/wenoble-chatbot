import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
// On importe le module interne : l'index de pdf-parse contient un mode debug
// qui tente de lire un PDF de test au chargement et casse en ESM.
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

export interface PdfPage {
  file: string;
  page: number;
  text: string;
}

/** Extrait le texte d'un PDF, page par page. */
export async function readPdf(filePath: string): Promise<PdfPage[]> {
  const buffer = await readFile(filePath);
  const file = path.basename(filePath);
  const pages: PdfPage[] = [];

  // pdf-parse concatène tout par défaut ; ce hook nous laisse récupérer
  // le texte page par page, ce qui permet de citer la page dans `source`.
  await pdfParse(buffer, {
    pagerender: async (pageData: any) => {
      const content = await pageData.getTextContent();
      const text = content.items.map((item: any) => item.str).join(' ');
      pages.push({ file, page: pages.length + 1, text });
      return text;
    },
  });

  return pages;
}

/**
 * Liste les PDF à partir d'un chemin qui peut être :
 *   - un fichier .pdf              → ./content/brandbook.pdf
 *   - un dossier (parcouru en récursif) → ./content
 * Retourne [] si le chemin n'existe pas.
 */
export async function listPdfs(target: string): Promise<string[]> {
  let info;
  try {
    info = await stat(target);
  } catch {
    return [];
  }

  if (info.isFile()) {
    return target.toLowerCase().endsWith('.pdf') ? [target] : [];
  }

  const found: string[] = [];
  const entries = await readdir(target, { withFileTypes: true });

  for (const entry of entries) {
    const full = path.join(target, entry.name);
    if (entry.isDirectory()) found.push(...(await listPdfs(full)));
    else if (entry.name.toLowerCase().endsWith('.pdf')) found.push(full);
  }

  return found;
}
