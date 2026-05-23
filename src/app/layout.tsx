import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MahlZeitPlaner',
  description: 'Wöchentlicher Familienmenüplaner für die Schweiz',
  manifest: '/manifest.json',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#b5614a" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,700;0,9..144,900;1,9..144,700&family=DM+Sans:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
        {children}
      </body>
    </html>
  );
}
