import { describe, it, expect } from 'vitest';
import { resolveAccessState, type AppUser } from '../users';

const morgen  = new Date(Date.now() + 86_400_000).toISOString();
const gestern = new Date(Date.now() - 86_400_000).toISOString();

function user(over: Partial<AppUser> = {}): AppUser {
  return {
    id: 'u1', firstName: 'Test', lastName: 'Person', email: 'test@example.ch',
    passwordHash: 'x', plan: 'trial', status: 'active',
    registeredAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

const gruppe = (over: Partial<{ orphaned: boolean; ownerEmail: string }> = {}) =>
  ({ ownerEmail: 'owner@example.ch', ...over });

describe('resolveAccessState — eigener Zugriff', () => {
  it('sperrt einen unbekannten Nutzer', () => {
    expect(resolveAccessState(null, null, null)).toEqual({ locked: true, reason: null });
  });

  it('laesst Premium immer durch', () => {
    expect(resolveAccessState(user({ plan: 'lifetime' }), null, null)).toEqual({ locked: false, reason: null });
    expect(resolveAccessState(user({ plan: 'abo' }), null, null).locked).toBe(false);
  });

  it('sperrt bei abgelaufenem eigenem Trial', () => {
    expect(resolveAccessState(user({ accessUntil: gestern }), null, null))
      .toEqual({ locked: true, reason: 'trial-expired' });
  });

  it('laesst einen laufenden eigenen Trial durch', () => {
    expect(resolveAccessState(user({ accessUntil: morgen }), null, null).locked).toBe(false);
  });

  it('sperrt bei verwaister Gruppe', () => {
    expect(resolveAccessState(user(), gruppe({ orphaned: true }), null))
      .toEqual({ locked: true, reason: 'group-orphaned' });
  });
});

describe('resolveAccessState — Vererbung an Mitglieder', () => {
  const mitglied = (over: Partial<AppUser> = {}) =>
    user({ email: 'kind@example.ch', groupRole: 'member', groupId: 'g1', ...over });

  it('erbt den Zugriff von einem Owner mit Premium', () => {
    const res = resolveAccessState(mitglied({ accessUntil: gestern }), gruppe(), user({ email: 'owner@example.ch', plan: 'lifetime' }));
    expect(res.locked).toBe(false);
  });

  it('erbt den Zugriff von einem Owner mit LAUFENDEM Trial', () => {
    // Genau die Luecke: vorher fiel die Pruefung hier auf den eigenen Trial des
    // Mitglieds zurueck. Wer der Familie spaeter beitrat und dessen eigener Trial
    // abgelaufen war, wurde gesperrt, waehrend der Owner weiterarbeiten konnte.
    const res = resolveAccessState(
      mitglied({ accessUntil: gestern }),
      gruppe(),
      user({ email: 'owner@example.ch', plan: 'trial', accessUntil: morgen }),
    );
    expect(res).toEqual({ locked: false, reason: null });
  });

  it('sperrt, wenn der Trial des Owners abgelaufen ist — auch bei gueltigem eigenem', () => {
    const res = resolveAccessState(
      mitglied({ accessUntil: morgen }),
      gruppe(),
      user({ email: 'owner@example.ch', plan: 'trial', accessUntil: gestern }),
    );
    expect(res).toEqual({ locked: true, reason: 'trial-expired' });
  });

  it('faellt auf den eigenen Zustand zurueck, wenn es den Owner nicht mehr gibt', () => {
    expect(resolveAccessState(mitglied({ accessUntil: gestern }), gruppe(), null).locked).toBe(true);
    expect(resolveAccessState(mitglied({ accessUntil: morgen }),  gruppe(), null).locked).toBe(false);
  });

  it('der Owner selbst erbt nichts von sich', () => {
    const owner = user({ email: 'owner@example.ch', groupRole: 'owner', groupId: 'g1', accessUntil: gestern });
    expect(resolveAccessState(owner, gruppe(), null))
      .toEqual({ locked: true, reason: 'trial-expired' });
  });

  it('vergleicht die Owner-Adresse ohne Ruecksicht auf Gross- und Kleinschreibung', () => {
    const res = resolveAccessState(
      user({ email: 'Owner@Example.ch', groupRole: 'member', groupId: 'g1', accessUntil: gestern }),
      gruppe({ ownerEmail: 'owner@example.ch' }),
      null,
    );
    // Ist selbst der Owner → keine Vererbung, eigener Zustand gilt.
    expect(res).toEqual({ locked: true, reason: 'trial-expired' });
  });

  it('verwaiste Gruppe schlaegt die Vererbung', () => {
    const res = resolveAccessState(
      mitglied(), gruppe({ orphaned: true }), user({ email: 'owner@example.ch', plan: 'lifetime' }),
    );
    expect(res).toEqual({ locked: true, reason: 'group-orphaned' });
  });
});
