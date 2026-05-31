export const dynamic = 'force-dynamic';

import { NextResponse }                                           from 'next/server';
import { getUserByConfirmationToken, deleteConfirmationTokenIndex,
         updateUser }                                            from '@/lib/users';
import { createGroup, newGroupId }                               from '@/lib/groups';
import { getAppUrl }                                             from '@/lib/email';

/**
 * GET /api/auth/confirm?token=XXX
 *
 * Validiert das Bestätigungs-Token und aktiviert den Account.
 * Linear-Scan über alle User (OK bei <1000 Usern).
 *
 * Redirects:
 *  - Erfolg:    /auth?confirmed=1
 *  - Ungültig:  /auth?error=invalid_token
 *  - Abgelaufen: /auth?error=expired_token
 */
export async function GET(request: Request) {
  const url   = new URL(request.url);
  const token = url.searchParams.get('token')?.trim();
  const base  = getAppUrl();

  if (!token) {
    return NextResponse.redirect(`${base}/auth?error=invalid_token`);
  }

  // Fix #11: O(1) lookup via token index (Redis) instead of O(n) scan over all users.
  const user = await getUserByConfirmationToken(token);

  if (!user) {
    return NextResponse.redirect(`${base}/auth?error=invalid_token`);
  }

  // Ablauf prüfen
  if (user.confirmationTokenExpiresAt) {
    const expires = new Date(user.confirmationTokenExpiresAt).getTime();
    if (Number.isFinite(expires) && expires < Date.now()) {
      return NextResponse.redirect(`${base}/auth?error=expired_token`);
    }
  }

  // Account aktivieren + Token entfernen
  const updated = { ...user, status: 'active' as const };
  delete updated.confirmationToken;
  delete updated.confirmationTokenExpiresAt;

  // Trial: accessUntil setzen falls noch nicht vorhanden
  if (updated.plan === 'trial' && !updated.accessUntil) {
    updated.accessUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  }

  // Auto-create eigene Gruppe, falls noch keine zugeordnet (neuer User-Flow)
  if (!updated.groupId) {
    const groupId = newGroupId();
    await createGroup({
      id:         groupId,
      name:       'Meine Familie',
      nameSet:    false,
      ownerEmail: updated.email,
      createdAt:  new Date().toISOString(),
    });
    updated.groupId   = groupId;
    updated.groupRole = 'owner';
  }

  await Promise.all([
    updateUser(updated),
    deleteConfirmationTokenIndex(token), // clean up the token index key
  ]);

  return NextResponse.redirect(`${base}/auth?confirmed=1`);
}
