import Image from 'next/image';

interface WordmarkProps {
  size?: number;
  light?: boolean;
  showMark?: boolean;
}

export function Wordmark({ size = 22, light = false, showMark = true }: WordmarkProps) {
  const ink = light ? '#fff' : 'var(--ink)';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.42 }}>
      {showMark && (
        <Image
          src="/Logo-Mahlzeit.png"
          alt="MahlZyt"
          width={Math.round(size * 1.4)}
          height={Math.round(size * 1.4)}
          style={{ objectFit: 'contain', flexShrink: 0 }}
        />
      )}
      <span style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 800,
        fontSize: size,
        letterSpacing: '-0.03em',
        lineHeight: 1,
        color: ink,
      }}>
        Mahl<span style={{ color: 'var(--accent)' }}>Zyt</span>
      </span>
    </span>
  );
}
