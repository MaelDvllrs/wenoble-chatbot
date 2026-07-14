/** Un chunk prêt à être embeddé puis inséré dans la table `documents`. */
export interface Chunk {
  /** Origine lisible : 'site:/services', 'blog:/blog/xxx', 'brandbook:identite.pdf#p12'. */
  source: string;
  /** Le texte du chunk, tel qu'il sera envoyé à Voyage. */
  content: string;
  /** SHA-256 du content : permet de ne ré-embedder que ce qui a changé. */
  hash: string;
  metadata: {
    /**
     * `site` = pages agence (services, offres, contact) — prioritaires quand la
     * question porte sur Wenoble.
     * `blog` = articles éditoriaux : utiles mais à pondérer plus bas, sinon leur
     * volume noie les pages agence dans les résultats de recherche.
     */
    type: 'site' | 'blog' | 'brandbook';
    title?: string;
    url?: string;
    file?: string;
    page?: number;
    /** Position du chunk dans son document d'origine (0-indexé). */
    index: number;
  };
}
