/**
 * Root layout — minimal wrapper required by Next.js.
 * All navigable routes live under [locale]/ which provides the full HTML structure.
 * This layout is only reached by routes outside [locale] (e.g. root-level not-found).
 */
import type { ReactNode } from 'react';

export default function RootLayout({ children }: { children: ReactNode }) {
  // Return children directly — [locale]/layout.tsx provides <html> and <body>.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return children as any;
}
