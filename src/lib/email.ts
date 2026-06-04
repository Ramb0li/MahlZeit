/**
 * E-Mail-Versand via Resend.
 *
 * Bei lokaler Entwicklung ohne RESEND_API_KEY wird der Bestätigungslink in die
 * Server-Konsole geloggt — so kann man Confirm-Flow testen, ohne Email-Setup.
 *
 * Erforderliche Env-Vars (Produktion):
 *  - RESEND_API_KEY     — API-Schlüssel von resend.com
 *  - APP_URL            — z.B. https://app.mahlzeitplaner.ch
 *  - FROM_EMAIL         — z.B. "MahlZeit <noreply@mahlzeitplaner.ch>" (Domain muss bei Resend verifiziert sein)
 */

import type { AppUser } from './users';

export function getAppUrl(): string {
  // `||` statt `??` — auch leerer String aus .env soll auf Fallback springen
  return (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:3000'
  );
}

function getFromEmail(): string {
  return process.env.FROM_EMAIL || 'MahlZeit <onboarding@resend.dev>';
}

// ─── HTML + Plain-Text Templates ─────────────────────────────────────────────

function mzEmailShell(bodyContent: string): string {
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ece6de;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ece6de;padding:32px 16px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(39,31,26,.18);">
      <!-- Header -->
      <tr><td style="background:#271f1a;padding:24px 32px;">
        <span style="font-size:20px;font-weight:900;letter-spacing:-.03em;color:#fff;">Mahl<span style="color:#d9543b;">Zeit</span></span>
      </td></tr>
      <!-- Body -->
      <tr><td style="background:#faf7f2;padding:36px 32px 28px;">
        ${bodyContent}
      </td></tr>
      <!-- Footer -->
      <tr><td style="background:#f0ebe3;padding:16px 32px;text-align:center;">
        <p style="margin:0;font-size:12px;color:#9a8c80;">MahlZeit &middot; Wochenplaner für Familien &middot; <a href="mailto:info@o-v-k.ch" style="color:#9a8c80;text-decoration:none;">info@o-v-k.ch</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function htmlBody(firstName: string, confirmUrl: string): string {
  return mzEmailShell(`
    <p style="font-size:16px;font-weight:600;color:#271f1a;margin:0 0 8px;">Hallo ${escapeHtml(firstName)},</p>
    <p style="font-size:15px;line-height:1.65;color:#5c5048;margin:0 0 20px;">
      schön, dass du dich für <strong style="color:#271f1a;">MahlZeit</strong> angemeldet hast —
      den Wochen-Menüplaner, der euch Zeit, Geld und das tägliche
      «Was koche ich heute?» abnimmt.
    </p>
    <p style="font-size:15px;line-height:1.65;color:#5c5048;margin:0 0 28px;">
      Bitte bestätige deine E-Mail-Adresse:
    </p>
    <div style="text-align:center;margin:0 0 28px;">
      <a href="${confirmUrl}" style="display:inline-block;background:#d9543b;color:#fff;padding:13px 32px;border-radius:999px;text-decoration:none;font-weight:700;font-size:15px;">
        E-Mail bestätigen &rarr;
      </a>
    </div>
    <p style="font-size:13px;color:#9a8c80;line-height:1.6;margin:0 0 8px;">
      Der Link ist 24 Stunden gültig. Falls der Button nicht funktioniert, kopiere diesen Link:
    </p>
    <p style="font-size:12px;color:#9a8c80;word-break:break-all;margin:0 0 24px;">${confirmUrl}</p>
    <hr style="border:none;border-top:1px solid #e0d8ce;margin:24px 0;">
    <p style="font-size:12px;color:#9a8c80;line-height:1.5;margin:0;">
      Nicht angemeldet? Diese E-Mail einfach ignorieren — der Account wird nach 24 Stunden gelöscht.
    </p>
  `);
}

function textBody(firstName: string, confirmUrl: string): string {
  return `Hallo ${firstName},

schön, dass du dich für MahlZeit angemeldet hast.

Bitte bestätige deine E-Mail-Adresse mit einem Klick auf den folgenden Link:

${confirmUrl}

Der Link ist 24 Stunden gültig.

Falls du dich nicht bei MahlZeit angemeldet hast, ignoriere diese E-Mail —
ohne Bestätigung wird der Account nach 24 Stunden automatisch gelöscht.

Herzliche Grüsse
Oliver · MahlZeit`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── Send ───────────────────────────────────────────────────────────────────

// ─── Group Invite ───────────────────────────────────────────────────────────

function inviteHtml(groupName: string, inviterName: string, acceptUrl: string): string {
  return mzEmailShell(`
    <p style="font-size:16px;font-weight:600;color:#271f1a;margin:0 0 8px;">Hallo,</p>
    <p style="font-size:15px;line-height:1.65;color:#5c5048;margin:0 0 20px;">
      <strong style="color:#271f1a;">${escapeHtml(inviterName)}</strong> hat dich zur Gruppe
      <strong style="color:#271f1a;">${escapeHtml(groupName)}</strong> auf
      <strong style="color:#271f1a;">MahlZeit</strong> eingeladen — dem Wochen-Menüplaner für Familien.
    </p>
    <p style="font-size:15px;line-height:1.65;color:#5c5048;margin:0 0 28px;">
      Klicke auf den Button, um beizutreten. Beim ersten Login wirst du nach Name und Passwort gefragt.
    </p>
    <div style="text-align:center;margin:0 0 28px;">
      <a href="${acceptUrl}" style="display:inline-block;background:#d9543b;color:#fff;padding:13px 32px;border-radius:999px;text-decoration:none;font-weight:700;font-size:15px;">
        Einladung annehmen &rarr;
      </a>
    </div>
    <p style="font-size:13px;color:#9a8c80;line-height:1.6;margin:0 0 8px;">
      Der Link ist 7 Tage gültig. Falls der Button nicht funktioniert, kopiere diesen Link:
    </p>
    <p style="font-size:12px;color:#9a8c80;word-break:break-all;margin:0 0 24px;">${acceptUrl}</p>
    <hr style="border:none;border-top:1px solid #e0d8ce;margin:24px 0;">
    <p style="font-size:12px;color:#9a8c80;line-height:1.5;margin:0;">
      Den Absender nicht kennen? Diese E-Mail einfach ignorieren.
    </p>
  `);
}

function inviteText(groupName: string, inviterName: string, acceptUrl: string): string {
  return `Hallo,

${inviterName} hat dich zur Gruppe "${groupName}" auf MahlZeit eingeladen.

MahlZeit ist ein Wochen-Menüplaner für Familien. Klicke auf den Link, um beizutreten:

${acceptUrl}

Der Link ist 7 Tage gültig.

Falls du den Absender nicht kennst, ignoriere diese E-Mail einfach.

Herzliche Grüsse
Das MahlZeit-Team`;
}

export async function sendInviteEmail(
  toEmail: string,
  groupName: string,
  inviterName: string,
  token: string,
): Promise<void> {
  const acceptUrl = `${getAppUrl()}/auth/accept-invite?token=${encodeURIComponent(token)}`;
  const apiKey    = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log(
      `\n[email] RESEND_API_KEY nicht gesetzt — Einladungs-URL:\n  ${acceptUrl}\n  (an: ${toEmail}, Gruppe: ${groupName})\n`
    );
    return;
  }

  const { Resend } = await import('resend');
  const resend     = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from:    getFromEmail(),
    to:      toEmail,
    subject: `${inviterName} hat dich zu "${groupName}" eingeladen — MahlZeit`,
    html:    inviteHtml(groupName, inviterName, acceptUrl),
    text:    inviteText(groupName, inviterName, acceptUrl),
  });

  if (error) {
    console.error('[email] Invite-Versand fehlgeschlagen:', error);
    throw new Error('E-Mail-Versand fehlgeschlagen');
  }
}

// ─── Password Reset ─────────────────────────────────────────────────────────

function resetHtml(firstName: string, resetUrl: string): string {
  return mzEmailShell(`
    <p style="font-size:16px;font-weight:600;color:#271f1a;margin:0 0 8px;">Hallo ${escapeHtml(firstName)},</p>
    <p style="font-size:15px;line-height:1.65;color:#5c5048;margin:0 0 28px;">
      wir haben eine Anfrage erhalten, das Passwort für deinen MahlZeit-Account zurückzusetzen.
      Klicke auf den Button, um ein neues Passwort festzulegen:
    </p>
    <div style="text-align:center;margin:0 0 28px;">
      <a href="${resetUrl}" style="display:inline-block;background:#d9543b;color:#fff;padding:13px 32px;border-radius:999px;text-decoration:none;font-weight:700;font-size:15px;">
        Passwort zurücksetzen &rarr;
      </a>
    </div>
    <p style="font-size:13px;color:#9a8c80;line-height:1.6;margin:0 0 8px;">
      Der Link ist <strong>1 Stunde</strong> gültig. Falls der Button nicht funktioniert, kopiere diesen Link:
    </p>
    <p style="font-size:12px;color:#9a8c80;word-break:break-all;margin:0 0 24px;">${resetUrl}</p>
    <hr style="border:none;border-top:1px solid #e0d8ce;margin:24px 0;">
    <p style="font-size:12px;color:#9a8c80;line-height:1.5;margin:0;">
      Kein Reset angefordert? Diese E-Mail ignorieren — dein Passwort bleibt unverändert.
    </p>
  `);
}

function resetText(firstName: string, resetUrl: string): string {
  return `Hallo ${firstName},

wir haben eine Anfrage erhalten, das Passwort für deinen MahlZeit-Account zurückzusetzen.

Klicke auf den folgenden Link, um ein neues Passwort festzulegen:

${resetUrl}

Der Link ist 1 Stunde gültig.

Falls du kein Passwort-Reset angefordert hast, ignoriere diese E-Mail einfach.
Dein Passwort bleibt unverändert.

Herzliche Grüsse
Das MahlZeit-Team`;
}

export async function sendPasswordResetEmail(
  firstName: string,
  toEmail: string,
  token: string,
): Promise<void> {
  const resetUrl = `${getAppUrl()}/auth?mode=reset&token=${encodeURIComponent(token)}`;
  const apiKey   = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log(
      `\n[email] RESEND_API_KEY nicht gesetzt — Passwort-Reset-URL:\n  ${resetUrl}\n  (User: ${toEmail})\n`
    );
    return;
  }

  const { Resend } = await import('resend');
  const resend     = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from:    getFromEmail(),
    to:      toEmail,
    subject: 'Dein MahlZeit-Passwort zurücksetzen',
    html:    resetHtml(firstName, resetUrl),
    text:    resetText(firstName, resetUrl),
  });

  if (error) {
    console.error('[email] Passwort-Reset-Versand fehlgeschlagen:', error);
    throw new Error('E-Mail-Versand fehlgeschlagen');
  }
}

// ─── Account Setup (nach Stripe-Zahlung) ────────────────────────────────────

function setupHtml(firstName: string, setupUrl: string): string {
  return mzEmailShell(`
    <p style="font-size:16px;font-weight:600;color:#271f1a;margin:0 0 8px;">Hallo ${escapeHtml(firstName)},</p>
    <p style="font-size:15px;line-height:1.65;color:#5c5048;margin:0 0 8px;">
      <strong style="color:#4a7a4e;">Zahlung erfolgreich!</strong> Danke für dein Vertrauen in MahlZeit.
    </p>
    <p style="font-size:15px;line-height:1.65;color:#5c5048;margin:0 0 28px;">
      Klicke auf den Button, um dein Passwort festzulegen und direkt loszulegen:
    </p>
    <div style="text-align:center;margin:0 0 28px;">
      <a href="${setupUrl}" style="display:inline-block;background:#d9543b;color:#fff;padding:13px 32px;border-radius:999px;text-decoration:none;font-weight:700;font-size:15px;">
        Konto einrichten &rarr;
      </a>
    </div>
    <p style="font-size:13px;color:#9a8c80;line-height:1.6;margin:0 0 8px;">
      Der Link ist <strong>24 Stunden</strong> gültig. Falls der Button nicht funktioniert, kopiere diesen Link:
    </p>
    <p style="font-size:12px;color:#9a8c80;word-break:break-all;margin:0 0 24px;">${setupUrl}</p>
    <hr style="border:none;border-top:1px solid #e0d8ce;margin:24px 0;">
    <p style="font-size:12px;color:#9a8c80;line-height:1.5;margin:0;">
      Fragen? Schreib uns: <a href="mailto:info@o-v-k.ch" style="color:#9a8c80;">info@o-v-k.ch</a>
    </p>
  `);
}

function setupText(firstName: string, setupUrl: string): string {
  return `Hallo ${firstName},

Zahlung erfolgreich! Danke für dein Vertrauen in MahlZeit.

Klicke auf den folgenden Link, um dein Passwort festzulegen und direkt loszulegen:

${setupUrl}

Der Link ist 24 Stunden gültig.

Herzliche Grüsse
Das MahlZeit-Team`;
}

export async function sendAccountSetupEmail(
  firstName: string,
  toEmail:   string,
  token:     string,
): Promise<void> {
  const setupUrl = `${getAppUrl()}/auth?mode=reset&token=${encodeURIComponent(token)}&setup=1`;
  const apiKey   = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log(`\n[email] RESEND_API_KEY nicht gesetzt — Setup-URL:\n  ${setupUrl}\n  (User: ${toEmail})\n`);
    return;
  }

  const { Resend } = await import('resend');
  const resend     = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from:    getFromEmail(),
    to:      toEmail,
    subject: 'Dein MahlZeit-Konto ist bereit — Passwort festlegen',
    html:    setupHtml(firstName, setupUrl),
    text:    setupText(firstName, setupUrl),
  });

  if (error) {
    console.error('[email] Setup-Mail fehlgeschlagen:', error);
    throw new Error('E-Mail-Versand fehlgeschlagen');
  }
}

// ─── Confirmation ───────────────────────────────────────────────────────────

export async function sendConfirmationEmail(user: AppUser, token: string): Promise<void> {
  const confirmUrl = `${getAppUrl()}/api/auth/confirm?token=${encodeURIComponent(token)}`;
  const apiKey     = process.env.RESEND_API_KEY;

  // Local dev fallback: log the URL so testing works without Resend
  if (!apiKey) {
    console.log(
      `\n[email] RESEND_API_KEY nicht gesetzt — Bestätigungs-URL:\n  ${confirmUrl}\n  (User: ${user.email})\n`
    );
    return;
  }

  const { Resend } = await import('resend');
  const resend     = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from:    getFromEmail(),
    to:      user.email,
    subject: 'Willkommen bei MahlZeit — bitte bestätige deine E-Mail',
    html:    htmlBody(user.firstName, confirmUrl),
    text:    textBody(user.firstName, confirmUrl),
  });

  if (error) {
    console.error('[email] Resend Fehler:', error);
    throw new Error('E-Mail-Versand fehlgeschlagen');
  }
}
