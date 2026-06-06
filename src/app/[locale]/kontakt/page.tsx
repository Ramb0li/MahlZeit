import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import { LegalShell } from '@/components/landing/LegalShell';

export const metadata: Metadata = {
  title: 'Kontakt · MahlZeit',
  description: 'Nimm Kontakt mit dem MahlZeit-Team auf.',
};

export default function KontaktPage() {
  return (
    <LegalShell>
      <h1>Kontakt</h1>
      <p className="mz-legal-sub">Fragen, Feedback oder eine Idee? Wir freuen uns von dir zu hören.</p>

      <h2>Schreib uns</h2>
      <p>
        Am schnellsten erreichst du uns per E-Mail:&nbsp;
        <a href="mailto:info@o-v-k.ch">info@o-v-k.ch</a>
      </p>
      <p>
        MahlZeit wird mit viel Sorgfalt in Luzern, Schweiz entwickelt. Wir bemühen uns, Anfragen
        innerhalb weniger Werktage zu beantworten.
      </p>

      <h2>Weiteres</h2>
      <p>
        Rechtliche Angaben findest du im <Link href="/impressum">Impressum</Link>. Wie wir mit deinen
        Daten umgehen, erklärt unsere <Link href="/datenschutz">Datenschutzerklärung</Link>. Die
        Bedingungen zur Nutzung stehen in den <Link href="/nutzungsbedingungen">Nutzungsbedingungen</Link>.
      </p>
    </LegalShell>
  );
}
