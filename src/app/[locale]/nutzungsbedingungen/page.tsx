import type { Metadata } from 'next';
import { LegalShell } from '@/components/landing/LegalShell';

export const metadata: Metadata = {
  title: 'Nutzungsbedingungen · MahlZeit',
  description: 'Allgemeine Geschäfts- und Nutzungsbedingungen (AGB) von MahlZeit.',
};

/*
 * HINWEIS: KI-erstellte Vorlage. Vor Live-Schaltung juristisch prüfen lassen.
 * Preise/Pläne mit den tatsächlich in Stripe konfigurierten Werten abgleichen.
 */
export default function NutzungsbedingungenPage() {
  return (
    <LegalShell>
      <h1>Nutzungsbedingungen</h1>
      <p className="mz-legal-sub">Allgemeine Geschäftsbedingungen (AGB) für die Nutzung von MahlZeit.</p>

      <h2>1. Geltungsbereich</h2>
      <p>
        Diese Nutzungsbedingungen regeln das Verhältnis zwischen dem Betreiber von MahlZeit
        («wir», «uns») und den Nutzerinnen und Nutzern («du») der Anwendung unter
        <a href="https://mahlzeit.o-v-k.ch"> mahlzeit.o-v-k.ch</a>. Mit der Registrierung oder Nutzung
        akzeptierst du diese Bedingungen.
      </p>

      <h2>2. Leistungsbeschreibung</h2>
      <p>
        MahlZeit ist ein digitaler Menüplaner. Die App ermöglicht das Planen von Wochenmenüs, das
        Verwalten und Importieren von Rezepten (auch KI-gestützt aus URLs oder Fotos), das automatische
        Erstellen von Einkaufslisten sowie das Teilen innerhalb eines Haushalts. Der Funktionsumfang
        kann laufend weiterentwickelt werden.
      </p>

      <h2>3. Registrierung und Konto</h2>
      <p>
        Für die Nutzung ist ein Konto erforderlich. Du bist verpflichtet, wahrheitsgemässe Angaben zu
        machen, deine Zugangsdaten vertraulich zu behandeln und dein Konto nicht missbräuchlich oder
        rechtswidrig zu verwenden. Du bist für Aktivitäten unter deinem Konto verantwortlich.
      </p>

      <h2>4. Pläne und Preise</h2>
      <ul>
        <li><strong>Testwoche:</strong> 7 Tage kostenlos, kein Kreditkarteneintrag.</li>
        <li><strong>Monatsabo:</strong> CHF&nbsp;3 pro Monat, monatlich kündbar.</li>
        <li><strong>Jahresabo:</strong> CHF&nbsp;30 pro Jahr.</li>
        <li><strong>Lifetime:</strong> CHF&nbsp;99 einmalig, dauerhafte Nutzung inkl. künftiger Updates.</li>
      </ul>
      <p>Massgeblich sind die zum Zeitpunkt des Kaufs in der App angezeigten Preise und Leistungen. Alle Preise verstehen sich in Schweizer Franken.</p>

      <h2>5. Zahlung</h2>
      <p>
        Die Zahlungsabwicklung erfolgt über unseren Zahlungsdienstleister Stripe. Es gelten ergänzend
        die Bedingungen von Stripe. Abonnements verlängern sich entsprechend dem gewählten Modell,
        sofern sie nicht rechtzeitig gekündigt werden.
      </p>

      <h2>6. Laufzeit und Kündigung</h2>
      <p>
        Abonnements können jederzeit zum Ende der laufenden Abrechnungsperiode gekündigt werden. Der
        Lifetime-Plan ist eine einmalige Zahlung ohne Folgekosten. Wir können das Vertragsverhältnis
        bei schwerwiegenden Verstössen gegen diese Bedingungen ausserordentlich beenden.
      </p>

      <h2>7. Widerruf bei digitalen Inhalten</h2>
      <p>
        Für Konsumentinnen und Konsumenten in der EU besteht grundsätzlich ein 14-tägiges Widerrufsrecht.
        Bei digitalen Inhalten, die sofort bereitgestellt werden, erlischt dieses Recht, sobald du der
        sofortigen Bereitstellung ausdrücklich zugestimmt und zur Kenntnis genommen hast, dass du dadurch
        dein Widerrufsrecht verlierst. Nach schweizerischem Recht besteht für Online-Dienstleistungen kein
        gesetzliches Widerrufsrecht.
      </p>

      <h2>8. Rezepte, Nährwerte und KI-Funktionen</h2>
      <p>
        Rezepte, Mengen-, Nährwert- und Allergenangaben sowie KI-generierte Vorschläge und Importe dienen
        ausschliesslich der Inspiration und Orientierung. Wir übernehmen <strong>keine Gewähr</strong> für
        deren Richtigkeit, Vollständigkeit oder Eignung. Prüfe Angaben insbesondere bei Allergien,
        Unverträglichkeiten oder gesundheitlichen Einschränkungen stets eigenverantwortlich. MahlZeit
        ersetzt keine ernährungsmedizinische Beratung.
      </p>

      <h2>9. Haftung</h2>
      <p>
        Wir haften nur für Schäden, die wir vorsätzlich oder grobfahrlässig verursachen, im gesetzlich
        zulässigen Rahmen. Eine Haftung für leichte Fahrlässigkeit, für indirekte Schäden, Datenverluste
        oder entgangenen Gewinn ist – soweit gesetzlich zulässig – ausgeschlossen. Die App wird «wie
        besehen» und ohne Zusicherung ununterbrochener Verfügbarkeit bereitgestellt.
      </p>

      <h2>10. Urheberrecht und Nutzungsrechte</h2>
      <p>
        Sämtliche Inhalte der App sind urheberrechtlich geschützt. Du erhältst ein einfaches, nicht
        übertragbares Recht zur Nutzung im Rahmen dieser Bedingungen. Von dir eingegebene oder importierte
        Inhalte bleiben dein Eigentum; du sicherst zu, über die nötigen Rechte daran zu verfügen.
      </p>

      <h2>11. Änderungen der Bedingungen</h2>
      <p>
        Wir können diese Nutzungsbedingungen anpassen. Wesentliche Änderungen werden in geeigneter Form
        mitgeteilt. Massgeblich ist die jeweils veröffentlichte Fassung.
      </p>

      <h2>12. Anwendbares Recht und Gerichtsstand</h2>
      <p>
        Es gilt ausschliesslich schweizerisches Recht unter Ausschluss der Kollisionsnormen und des
        UN-Kaufrechts. Ausschliesslicher Gerichtsstand ist – soweit gesetzlich zulässig – Luzern, Schweiz.
        Zwingende Verbraucherschutzbestimmungen am Wohnsitz von Konsumentinnen und Konsumenten bleiben
        vorbehalten.
      </p>

      <p className="mz-legal-sub" style={{ marginTop: 40 }}>Stand: Juni 2026</p>
    </LegalShell>
  );
}
