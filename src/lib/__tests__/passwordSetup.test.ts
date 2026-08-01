import { describe, it, expect } from 'vitest';
import bcrypt from 'bcryptjs';
import { needsPasswordSetup } from '../users';

/**
 * Regression fuer den gemeldeten Bug: Wer per Stripe bezahlt hat, bekam nie eine
 * Passwort-Setzen-Mail und war nach Ablauf des Session-Cookies ausgesperrt.
 *
 * Ursache war die Erkennung "neues Konto" ueber das Hash-Praefix:
 *   user.status === 'pending' && !user.passwordHash.startsWith('$2')
 * /api/auth/register legt Stripe-Konten aber mit einem echten bcrypt-Hash eines
 * Zufallswerts an — der beginnt ebenfalls mit '$2'. Die Bedingung war damit
 * immer false, der Zweig mit sendAccountSetupEmail toter Code.
 */
describe('needsPasswordSetup', () => {
  it('erkennt ein frisch per Stripe angelegtes Konto', () => {
    expect(needsPasswordSetup({ status: 'pending', passwordSet: undefined })).toBe(true);
  });

  it('erkennt ein Konto, dessen Passwort beim Bezahlen ueberschrieben wurde', () => {
    // register() setzt passwordSet bewusst auf false, wenn es den bestehenden
    // Hash eines pending-Kontos durch den Zufalls-Platzhalter ersetzt.
    expect(needsPasswordSetup({ status: 'pending', passwordSet: false })).toBe(true);
  });

  it('erkennt eine Trial-Registrierung mit eigenem Passwort NICHT als Neuanlage', () => {
    expect(needsPasswordSetup({ status: 'pending', passwordSet: true })).toBe(false);
  });

  it('erkennt ein bestehendes aktives Konto beim Upgrade NICHT als Neuanlage', () => {
    expect(needsPasswordSetup({ status: 'active', passwordSet: true })).toBe(false);
    expect(needsPasswordSetup({ status: 'active', passwordSet: undefined })).toBe(false);
  });

  it('der Platzhalter-Hash aus register() beginnt mit "$2" — die alte Heuristik konnte nie greifen', async () => {
    const placeholder = await bcrypt.hash('zufallswert', 10);
    expect(placeholder.startsWith('$2')).toBe(true);

    // Genau das war die alte Bedingung — sie war fuer JEDES Stripe-Konto false.
    const oldHeuristic = !placeholder.startsWith('$2');
    expect(oldHeuristic).toBe(false);

    // Die neue Pruefung erkennt denselben Fall korrekt.
    expect(needsPasswordSetup({ status: 'pending', passwordSet: undefined })).toBe(true);
  });
});
