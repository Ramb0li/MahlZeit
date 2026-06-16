import Image              from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Link }            from '@/i18n/navigation';

export async function SiteFooter({ year = '2025' }: { year?: string }) {
  const t = await getTranslations('SiteFooter');

  const FOOT_LINKS = [
    { href: '/datenschutz' as const,         label: t('privacy') },
    { href: '/impressum' as const,           label: t('imprint') },
    { href: '/nutzungsbedingungen' as const, label: t('terms')   },
    { href: '/kontakt' as const,             label: t('contact') },
  ];

  return (
    <footer className="mz-lp-footer">
      <Link href="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <Image src="/Logo-Mahlzeit.png" alt="MahlZyt" width={24} height={24} style={{ objectFit: 'contain' }} />
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, letterSpacing: '-0.03em', color: 'var(--ink)' }}>
          Mahl<span style={{ color: 'var(--accent)' }}>Zeit</span>
        </span>
      </Link>
      <div className="mz-lp-foot-links">
        {FOOT_LINKS.map(({ href, label }) => (
          <Link key={href} href={href}>{label}</Link>
        ))}
      </div>
      <span className="mz-lp-foot-copy">&copy; {year} MahlZyt &middot; @cuiseline</span>
    </footer>
  );
}
