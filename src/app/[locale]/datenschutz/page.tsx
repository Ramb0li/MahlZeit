import type { Metadata } from 'next';
import { LegalShell } from '@/components/landing/LegalShell';

export const metadata: Metadata = {
  title: 'Datenschutzerklärung · MahlZeit',
  description: 'Wie MahlZeit personenbezogene Daten erhebt, verarbeitet und schützt (revDSG & DSGVO).',
};

/*
 * HINWEIS: KI-erstellte Vorlage, ausgelegt für Schweizer revDSG + EU-DSGVO.
 * Vor Live-Schaltung juristisch prüfen lassen. [DEIN VOLLSTÄNDIGER NAME] ersetzen.
 */
export default function DatenschutzPage() {
  return (
    <LegalShell>
      <h1>Datenschutzerklärung</h1>
      <p className="mz-legal-sub">
        Diese Erklärung gilt für die Schweiz (revidiertes Datenschutzgesetz, revDSG) und – soweit
        anwendbar – für die EU (Datenschutz-Grundverordnung, DSGVO).
      </p>

      <h2>1. Verantwortlicher</h2>
      <p>
        Verantwortlich für die Datenbearbeitung ist:<br />
        MahlZeit · [O. und C. von Kaenel], Luzernerstrasse 59d, 6030 Ebikon, Schweiz<br />
        E-Mail: <a href="mailto:info@o-v-k.ch">info@o-v-k.ch</a>
      </p>

      <h2>2. Welche Daten wir bearbeiten</h2>
      <ul>
        <li><strong>Kontodaten:</strong> E-Mail-Adresse und Passwort (nur als kryptografischer bcrypt-Hash gespeichert, niemals im Klartext).</li>
        <li><strong>Haushalts- &amp; Profildaten:</strong> Gruppen-/Familienname, Anzahl Personen, Ernährungsweise, Allergien, Einkaufsrhythmus und ähnliche Einstellungen, die du selbst eingibst.</li>
        <li><strong>Standort:</strong> Der von dir angegebene Ort, um wetter- und saisonbasierte Vorschläge zu erstellen.</li>
        <li><strong>Nutzungsinhalte:</strong> Menüpläne, gespeicherte und importierte Rezepte, Einkaufslisten, Vorratseinträge.</li>
        <li><strong>Zahlungsdaten:</strong> Bei kostenpflichtigen Plänen werden Zahlungen über Stripe abgewickelt. Kreditkarten- bzw. Zahlungsdaten werden direkt von Stripe verarbeitet; wir speichern keine vollständigen Zahlungsmitteldaten.</li>
        <li><strong>Technische Daten:</strong> Server-Logfiles (z.&nbsp;B. IP-Adresse, Zeitpunkt, abgerufene Ressource), die beim Betrieb automatisch anfallen.</li>
      </ul>

      <h2>3. Zwecke und Rechtsgrundlagen</h2>
      <p>Wir bearbeiten deine Daten zu folgenden Zwecken:</p>
      <ul>
        <li>Bereitstellung und Betrieb des Kontos sowie der Planungs-, Rezept- und Einkaufslistenfunktionen (Vertragserfüllung, Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;b DSGVO);</li>
        <li>Versand notwendiger E-Mails wie Kontobestätigung, Einladungen und Passwort-Zurücksetzung (Vertragserfüllung);</li>
        <li>Abwicklung von Zahlungen (Vertragserfüllung);</li>
        <li>Sicherheit, Stabilität und Missbrauchsvermeidung (berechtigtes Interesse, Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;f DSGVO);</li>
        <li>wetter- und saisonbasierte Vorschläge (berechtigtes Interesse bzw. Einwilligung).</li>
      </ul>
      <p>Nach revDSG stützen wir die Bearbeitung auf die Vertragserfüllung, dein Einverständnis sowie überwiegende berechtigte Interessen.</p>

      <h2>4. Auftragsverarbeiter und Drittanbieter</h2>
      <p>Zum Betrieb von MahlZeit setzen wir sorgfältig ausgewählte Dienstleister ein, die Daten nur in unserem Auftrag bearbeiten:</p>
      <table>
        <thead>
          <tr><th>Dienst</th><th>Zweck</th></tr>
        </thead>
        <tbody>
          <tr><td>Vercel</td><td>Hosting der Anwendung, Server-Logs, anonymisierte Webanalyse (Vercel Web Analytics)</td></tr>
          <tr><td>Upstash (Redis)</td><td>Datenbank für Konten, Rezepte, Pläne und Einstellungen</td></tr>
          <tr><td>Resend</td><td>Versand von Transaktions-E-Mails</td></tr>
          <tr><td>Stripe</td><td>Zahlungsabwicklung für kostenpflichtige Pläne</td></tr>
          <tr><td>Anthropic (Claude API)</td><td>KI-gestützter Rezept-Import: übermittelt von dir bereitgestellte URLs oder Fotos zur Texterkennung</td></tr>
          <tr><td>Open-Meteo</td><td>Wetterdaten anhand deines angegebenen Orts</td></tr>
        </tbody>
      </table>
      <p>
        Aktionsdaten von Schweizer Supermärkten (Migros, Coop, Lidl) werden serverseitig abgerufen,
        ohne dass dabei personenbezogene Daten von dir übermittelt werden.
      </p>

      <h2>5. Datenübermittlung ins Ausland</h2>
      <p>
        Einige der genannten Anbieter (insbesondere Vercel, Stripe und Anthropic) können Daten in den
        USA oder anderen Drittstaaten bearbeiten. Die Übermittlung erfolgt auf Grundlage geeigneter
        Garantien wie Standardvertragsklauseln (Standard Contractual Clauses) bzw. anerkannter
        Angemessenheitsmechanismen, um ein dem schweizerischen und europäischen Recht entsprechendes
        Schutzniveau sicherzustellen.
      </p>

      <h2>6. Cookies</h2>
      <p>
        MahlZeit verwendet ausschliesslich einen technisch notwendigen Cookie (<code>mz_token</code>),
        der deine Anmeldung speichert (HTTP-only). Es werden <strong>keine</strong> Tracking-,
        Analyse- oder Werbe-Cookies eingesetzt. Daher ist kein Cookie-Banner erforderlich.
      </p>

      <h2>7. Webanalyse</h2>
      <p>
        Zur Verbesserung der App nutzen wir <strong>Vercel Web Analytics</strong>. Dieser Dienst
        erfasst Seitenaufrufe und grundlegende technische Angaben (z.&nbsp;B. Gerätetyp, Browser,
        Herkunftsland, Referrer) <strong>vollständig anonymisiert und ohne Cookies</strong>. Es werden
        keine persönlichen Profile erstellt, keine IP-Adressen dauerhaft gespeichert und kein
        seitenübergreifendes Tracking durchgeführt. Eine Identifikation einzelner Besucherinnen und
        Besucher ist nicht möglich. Rechtsgrundlage ist unser berechtigtes Interesse an der
        Analyse und Verbesserung unseres Angebots (Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;f DSGVO bzw.
        überwiegendes berechtigtes Interesse nach revDSG).
      </p>

      <h2>8. Speicherdauer</h2>
      <p>
        Wir bearbeiten personenbezogene Daten, solange dein Konto besteht bzw. solange es für die
        genannten Zwecke erforderlich ist. Nach Löschung deines Kontos werden die zugehörigen Daten
        gelöscht, soweit keine gesetzlichen Aufbewahrungspflichten (z.&nbsp;B. für Zahlungsbelege)
        entgegenstehen.
      </p>

      <h2>9. Deine Rechte</h2>
      <p>Du hast – im Rahmen des anwendbaren Rechts – das Recht auf:</p>
      <ul>
        <li>Auskunft über die zu dir bearbeiteten Daten;</li>
        <li>Berichtigung unrichtiger Daten;</li>
        <li>Löschung («Recht auf Vergessenwerden»);</li>
        <li>Einschränkung der Bearbeitung;</li>
        <li>Widerspruch gegen bestimmte Bearbeitungen;</li>
        <li>Datenübertragbarkeit (Herausgabe in einem gängigen Format).</li>
      </ul>
      <p>
        Zur Ausübung deiner Rechte genügt eine E-Mail an <a href="mailto:info@o-v-k.ch">info@o-v-k.ch</a>.
      </p>

      <h2>10. Beschwerderecht</h2>
      <p>
        In der Schweiz kannst du dich an den Eidgenössischen Datenschutz- und Öffentlichkeitsbeauftragten
        (EDÖB) wenden. In der EU steht dir das Beschwerderecht bei der für dich zuständigen
        Datenschutz-Aufsichtsbehörde zu.
      </p>

      <h2>11. Änderungen</h2>
      <p>
        Wir können diese Datenschutzerklärung anpassen, etwa bei Weiterentwicklung der App oder
        Änderungen der Rechtslage. Es gilt jeweils die hier veröffentlichte Fassung.
      </p>

      <p className="mz-legal-sub" style={{ marginTop: 40 }}>Stand: Juni 2026</p>
    </LegalShell>
  );
}
