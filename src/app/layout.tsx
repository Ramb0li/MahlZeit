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
        <meta name="theme-color" content="#4CAF50" />
      </head>
      <body className="min-h-screen bg-white">
        {children}
      </body>
    </html>
  );
}
