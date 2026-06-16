import Image              from 'next/image';
import { ArrowLeft }      from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link }            from '@/i18n/navigation';
import { SiteFooter }      from './SiteFooter';

export async function LegalShell({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('LegalShell');

  return (
    <div className="mz-lp">
      {/* Schlanke Nav */}
      <nav className="mz-lp-nav">
        <Link href="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Image src="/Logo-Mahlzeit.png" alt="MahlZyt" width={28} height={28} style={{ objectFit: 'contain' }} />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, letterSpacing: '-0.03em', color: 'var(--ink)' }}>
            Mahl<span style={{ color: 'var(--accent)' }}>Zeit</span>
          </span>
        </Link>
        <Link href="/" className="mz-lp-login" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <ArrowLeft size={15} />
          {t('backHome')}
        </Link>
      </nav>

      <main className="mz-legal">{children}</main>

      <SiteFooter />
    </div>
  );
}
