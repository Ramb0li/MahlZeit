import Link from 'next/link';
import Image from 'next/image';

const FOOT_LINKS = [
  { href: '/datenschutz',        label: 'Datenschutz' },
  { href: '/impressum',          label: 'Impressum' },
  { href: '/nutzungsbedingungen', label: 'Nutzungsbedingungen' },
  { href: '/kontakt',            label: 'Kontakt' },
];

export function SiteFooter({ year = '2025' }: { year?: string }) {
  return (
    <footer className="mz-lp-footer">
      <Link href="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <Image src="/Logo-Mahlzeit.png" alt="MahlZeit" width={24} height={24} style={{ objectFit: 'contain' }} />
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, letterSpacing: '-0.03em', color: 'var(--ink)' }}>
          Mahl<span style={{ color: 'var(--accent)' }}>Zeit</span>
        </span>
      </Link>
      <div className="mz-lp-foot-links">
        {FOOT_LINKS.map(({ href, label }) => (
          <Link key={href} href={href}>{label}</Link>
        ))}
      </div>
      <span className="mz-lp-foot-copy">© {year} MahlZeit · @cuiseline</span>
    </footer>
  );
}
