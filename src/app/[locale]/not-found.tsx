import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Link }             from '@/i18n/navigation';

export default async function NotFound() {
  const t = await getTranslations('NotFound');

  return (
    <div
      className="mz-lp"
      style={{
        minHeight: '100svh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: 24,
        padding: '40px 20px',
      }}
    >
      <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
        <Image src="/Logo-Mahlzeit.png" alt="MahlZyt" width={36} height={36} style={{ objectFit: 'contain' }} />
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, letterSpacing: '-0.03em', color: 'var(--ink)' }}>
          Mahl<span style={{ color: 'var(--accent)' }}>Zyt</span>
        </span>
      </Link>

      <div style={{ fontSize: 'clamp(64px,18vw,120px)', lineHeight: 1, fontWeight: 900, color: 'var(--accent)', opacity: 0.12, userSelect: 'none' }}>
        404
      </div>

      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(20px,4.5vw,32px)', fontWeight: 800, color: 'var(--ink)', margin: 0, lineHeight: 1.25 }}>
        {t('title')}
      </h1>
      <p style={{ color: 'var(--muted)', fontSize: 16, maxWidth: 420, margin: 0, lineHeight: 1.6 }}>
        {t('description')}
      </p>

      <Link href="/" className="mz-btn-primary" style={{ fontSize: 15, padding: '12px 28px', marginTop: 4 }}>
        {t('backHome')}
      </Link>
    </div>
  );
}
