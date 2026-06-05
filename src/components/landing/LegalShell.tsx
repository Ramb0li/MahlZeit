import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';
import { SiteFooter } from './SiteFooter';

export function LegalShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mz-lp">
      {/* Schlanke Nav */}
      <nav className="mz-lp-nav">
        <Link href="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Image src="/Logo-Mahlzeit.png" alt="MahlZeit" width={28} height={28} style={{ objectFit: 'contain' }} />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, letterSpacing: '-0.03em', color: 'var(--ink)' }}>
            Mahl<span style={{ color: 'var(--accent)' }}>Zeit</span>
          </span>
        </Link>
        <Link href="/" className="mz-lp-login" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <ArrowLeft size={15} />
          Zur Startseite
        </Link>
      </nav>

      <main className="mz-legal">{children}</main>

      <SiteFooter />
    </div>
  );
}
