import type { Metadata } from 'next';
import { LegalShell } from '@/components/landing/LegalShell';

export const metadata: Metadata = {
  title: 'Impressum · MahlZyt',
  description: 'Impressum und Anbieterkennzeichnung von MahlZyt.',
};

/*
 * HINWEIS (vor Live-Schaltung beachten):
 * - [DEIN VOLLSTÄNDIGER NAME] durch den echten Namen der betreibenden Person ersetzen.
 * - Da Zahlungen über Stripe abgewickelt werden (= kommerzielles Angebot), ist eine
 *   ladungsfähige Postadresse rechtlich sicherer. Bewusst weggelassen auf Wunsch des Betreibers.
 * - Dieser Text ist eine KI-erstellte Vorlage und ersetzt keine Rechtsberatung.
 */
export default function ImpressumPage() {
  return (
    <LegalShell>
      <h1>Impressum</h1>
      <p className="mz-legal-sub">Angaben gemäss schweizerischem Recht (u.&nbsp;a. UWG Art.&nbsp;3 Abs.&nbsp;1 lit.&nbsp;s).</p>

      <h2>Anbieter</h2>
      <p>
        MahlZyt<br />
        [O. und C. von Kaenel]<br />
        Luzernerstrasse 59d
        6030 Ebikon, Schweiz<br />
        E-Mail: <a href="mailto:info@o-v-k.ch">info@o-v-k.ch</a><br />
        Web: <a href="https://www.mahlzyt.app">www.mahlzyt.app</a>
      </p>
      <p>
        MahlZyt ist ein privat betriebenes Angebot zur Menüplanung. Eine Eintragung im
        Handelsregister besteht nicht.
      </p>

      <h2>Verantwortlich für den Inhalt</h2>
      <p>[O. und C. von Kaenel], Kontakt wie oben.</p>

      <h2>Haftung für Inhalte</h2>
      <p>
        Die Inhalte dieser Anwendung werden mit grösstmöglicher Sorgfalt erstellt. Für die
        Richtigkeit, Vollständigkeit und Aktualität der Inhalte – insbesondere von Rezepten,
        Nährwert-, Mengen- und Allergenangaben sowie KI-generierten Vorschlägen – wird keine
        Gewähr übernommen. Die Nutzung erfolgt in eigener Verantwortung.
      </p>

      <h2>Haftung für Links</h2>
      <p>
        Unser Angebot enthält Links zu externen Webseiten Dritter, auf deren Inhalte wir keinen
        Einfluss haben. Für diese fremden Inhalte ist stets der jeweilige Anbieter verantwortlich.
      </p>

      <h2>Urheberrecht</h2>
      <p>
        Die durch den Betreiber erstellten Inhalte und Werke unterliegen dem schweizerischen
        Urheberrecht. Rezeptinhalte stammen teils von <a href="https://www.instagram.com/cuiseline/" target="_blank" rel="noopener noreferrer">@cuiseline</a>.
        Eine Vervielfältigung, Bearbeitung oder Verbreitung ausserhalb der App bedarf der
        schriftlichen Zustimmung des jeweiligen Urhebers.
      </p>

      <p className="mz-legal-sub" style={{ marginTop: 40 }}>Stand: Juni 2026</p>
    </LegalShell>
  );
}
