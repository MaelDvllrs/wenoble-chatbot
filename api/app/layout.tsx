/**
 * Ce projet n'expose que des Route Handlers (/chat, /history, /health) et les
 * fichiers du widget (public/widget). Ce layout n'existe que parce que Next
 * l'exige à la racine de app/ ; aucune page ne le rend.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
