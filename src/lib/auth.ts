/**
 * Auth utilities — JWT signing/verification via jose (Edge-compatible).
 * Passwords are hashed with bcryptjs in API routes (Node runtime only).
 */

import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

export const TOKEN_COOKIE  = 'mz_token';
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
export const ADMIN_EMAIL   = 'info@o-v-k.ch';

function getSecret() {
  // `||` statt `??` — leerer String (z.B. JWT_SECRET= in .env.local) muss auch den Fallback triggern,
  // sonst crasht jose mit "Zero-length key is not supported".
  const raw = process.env.JWT_SECRET || 'dev-fallback-secret-change-me';
  return new TextEncoder().encode(raw);
}

export interface SessionPayload {
  email:      string;
  plan:       'trial' | 'lifetime' | 'abo';
  status:     'active' | 'inactive' | 'pending';
  isAdmin:    boolean;
  groupId?:   string;
  groupRole?: 'owner' | 'member';
}

/** Sign a 30-day JWT — call only from API routes (Node runtime). */
export async function signToken(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .sign(getSecret());
}

/** Verify a JWT — works in both Node and Edge runtime. */
export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/** Read the session from the current request's cookies (Server Components / API routes). */
export async function getSession(): Promise<SessionPayload | null> {
  const jar   = await cookies();
  const token = jar.get(TOKEN_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

/** Set the session cookie (call from API route after successful auth). */
export function sessionCookieHeader(token: string): string {
  return `${TOKEN_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}${
    process.env.NODE_ENV === 'production' ? '; Secure' : ''
  }`;
}

/** Clear the session cookie. */
export function clearCookieHeader(): string {
  return `${TOKEN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
