/**
 * Erweiterte Session-Helper für API-Routes.
 *
 * Das JWT-Cookie wurde evtl. vor dem Groups-Rollout signiert und enthält
 * deshalb keine `groupId`. In diesem Fall holen wir die groupId+role
 * frisch aus dem User-Store, damit die Routes auch mit "alten" JWTs
 * funktionieren — ohne dass der User sich zwangsweise neu einloggen muss.
 */

import { getSession }      from './auth';
import { getUserByEmail }  from './users';
import type { SessionPayload } from './auth';

export async function getSessionWithGroup(): Promise<SessionPayload | null> {
  const session = await getSession();
  if (!session) return null;
  if (session.groupId) return session;

  // Fallback — User-Store nachschlagen
  const user = await getUserByEmail(session.email);
  if (!user?.groupId) return session;

  return { ...session, groupId: user.groupId, groupRole: user.groupRole };
}
