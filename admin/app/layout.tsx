import type { Metadata } from 'next';
import './globals.css';
import Nav from './nav';

export const metadata: Metadata = {
  title: 'Admin Wenoble Chatbot',
  description: 'Conversations et leads du chatbot Wenoble',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-neutral-50 text-neutral-900 antialiased">
        <Nav />
        {children}
      </body>
    </html>
  );
}
