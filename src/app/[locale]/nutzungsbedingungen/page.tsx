import type { Metadata } from 'next';
import { LegalShell } from '@/components/landing/LegalShell';

export const metadata: Metadata = {
  title: 'Nutzungsbedingungen · MahlZyt',
  description: 'Allgemeine Geschäfts- und Nutzungsbedingungen (AGB) von MahlZyt.',
};

export default function NutzungsbedingungenPage() {
  return (
    <LegalShell>
      <h1>Nutzungsbedingungen</h1>
      <p className="mz-legal-sub">Allgemeine Geschäftsbedingungen (AGB) für die Nutzung von MahlZyt.</p>

      <h2>1. Geltungsbereich</h2>
      <p>
        Diese Nutzungsbedingungen regeln das Verhältnis zwischen dem Betreiber von MahlZyt
        («wir», «uns») und den Nutzerinnen und Nutzern («du») der Anwendung unter
        <a href="https://mahlzeit.o-v-k.ch"> mahlzeit.o-v-k.ch</a>. Mit der Registrierung oder Nutzung
        akzeptierst du diese Bedingungen.
      </p>

      <h2>2. Leistungsbeschreibung</h2>
      <p>
        MahlZyt ist ein digitaler Menüplaner mit Wochenplanung, Rezeptverwaltung,
        KI-gestütztem Rezeptimport, automatischer Einkaufsliste und Haushaltsteilen.
        Der Funktionsumfang kann laufend weiterentwickelt werden.
      </p>

      <h2>3. Registrierung und Konto</h2>
      <p>
        Für die Nutzung ist ein Konto erforderlich. Du bist verpflichtet, wahrheitsgemässe Angaben zu
        machen, deine Zugangsdaten vertraulich zu behandeln und dein Konto nicht missbräuchlich zu verwenden.
        Du bist für alle Aktivitäten unter deinem Konto verantwortlich.
      </p>

      <h2>4. Pläne und Preise</h2>
      <ul>
        <li><strong>Testwoche:</strong> 7 Tage kostenlos, kein Kreditkarteneintrag.</li>
        <li><strong>Monatsabo:</strong> CHF&nbsp;4 pro Monat, monatlich kündbar.</li>
        <li><strong>Jahresabo:</strong> CHF&nbsp;40 pro Jahr (2 Monate gratis gegenüber dem Monatsabo).</li>
        <li><strong>Lifetime:</strong> CHF&nbsp;129 einmalig, dauerhafter Zugang inkl. künftiger Updates.</li>
      </ul>
      <p>Massgeblich sind die zum Zeitpunkt des Kaufs in der App angezeigten Preise. Alle Preise in Schweizer Franken.</p>

      <h2>5. Zahlung</h2>
      <p>
        Die Zahlungsabwicklung erfolgt über Stripe. Abonnements verlängern sich automatisch,
        sofern sie nicht rechtzeitig gekündigt werden.
      </p>

      <h2>6. Laufzeit und Kündigung</h2>
      <p>
        Abonnements können jederzeit zum Ende der laufenden Abrechnungsperiode gekündigt werden.
        Der Lifetime-Plan ist eine einmalige Zahlung ohne Folgekosten und gewährt dauerhaften Zugang,
        solange die App betrieben wird. Änderungen bleiben vorbehalten.
        Wir können das Vertragsverhältnis bei schwerwiegenden Verstössen gegen diese Bedingungen
        ausserordentlich beenden.
      </p>

      <h2>7. Widerruf</h2>
      <p>
        Für EU-Konsumentinnen und -Konsumenten besteht grundsätzlich ein 14-tägiges Widerrufsrecht,
        das bei digitalen Inhalten mit sofortiger Bereitstellung und ausdrücklicher Zustimmung erlischt.
        Nach schweizerischem Recht besteht kein gesetzliches Widerrufsrecht für Online-Dienstleistungen.
      </p>

      <h2>8. Rezepte, Nährwerte und KI</h2>
      <p>
        Rezepte, Mengen-, Nährwert- und Allergenangaben sowie KI-generierte Vorschläge dienen
        ausschliesslich der Inspiration. Wir übernehmen <strong>keine Gewähr</strong> für
        deren Richtigkeit oder Vollständigkeit. Prüfe Angaben bei Allergien oder gesundheitlichen
        Einschränkungen stets eigenverantwortlich. MahlZyt ersetzt keine ernährungsmedizinische Beratung.
      </p>

      <h2>9. Haftung</h2>
      <p>
        Wir haften nur für vorsätzlich oder grobfahrlässig verursachte Schäden. Eine Haftung für
        leichte Fahrlässigkeit, indirekte Schäden, Datenverluste oder entgangenen Gewinn ist –
        soweit gesetzlich zulässig – ausgeschlossen. Die App wird «wie besehen» ohne Zusicherung
        ununterbrochener Verfügbarkeit bereitgestellt.
      </p>

      <h2>10. Urheberrecht</h2>
      <p>
        Sämtliche App-Inhalte sind urheberrechtlich geschützt. Du erhältst ein einfaches,
        nicht übertragbares Nutzungsrecht. Von dir eingegebene Inhalte bleiben dein Eigentum.
      </p>

      <h2>11. Änderungen</h2>
      <p>
        Wir können diese Bedingungen anpassen. Wesentliche Änderungen werden in geeigneter Form
        mitgeteilt. Massgeblich ist die jeweils veröffentlichte Fassung.
      </p>

      <h2>12. Anwendbares Recht und Gerichtsstand</h2>
      <p>
        Es gilt schweizerisches Recht. Ausschliesslicher Gerichtsstand ist Luzern, Schweiz.
        Zwingende Verbraucherschutzbestimmungen am Wohnsitz von EU-Konsumentinnen und -Konsumenten
        bleiben vorbehalten.
      </p>

      <p className="mz-legal-sub" style={{ marginTop: 40 }}>Stand: Juni 2026</p>
    </LegalShell>
  );
}
