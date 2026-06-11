// Stripe redirects the user here after successful payment.
// Upgrades the user plan, creates a password-setup token, sends setup email, redirects.
export const dynamic = 'force-dynamic';

import { NextResponse }                              from 'next/server';
import { randomBytes }                               from 'crypto';
import Stripe                                        from 'stripe';
import { getUserByEmail, updateUser, reviveOrphanedGroup } from '@/lib/users';
import type { PlanType }                             from '@/lib/users';
import { ADMIN_EMAIL, signToken, sessionCookieHeader } from '@/lib/auth';
import { sendAccountSetupEmail }                     from '@/lib/email';

function stripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

const APP_URL = process.env.APP_URL ?? 'https://mahlzeit.o-v-k.ch';
const SETUP_TOKEN_TTL_SECS = 24 * 60 * 60; // 24h

async function storeSetupToken(token: string, email: string): Promise<void> {
  const expiresAt = Date.now() + SETUP_TOKEN_TTL_SECS * 1000;
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    const fs   = require('fs')   as typeof import('fs');
    const path = require('path') as typeof import('path');
    const file = path.join(process.cwd(), 'data', 'pwd-reset-tokens.json');
    const tokens = fs.existsSync(file)
      ? JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>
      : {};
    tokens[token] = { email, expiresAt };
    fs.writeFileSync(file, JSON.stringify(tokens, null, 2), 'utf-8');
    return;
  }
  const { Redis } = require('@upstash/redis') as typeof import('@upstash/redis');
  await Redis.fromEnv().set(`mz:pwd-reset:${token}`, { email, expiresAt }, { ex: SETUP_TOKEN_TTL_SECS });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('session_id');

  if (!sessionId) {
    return NextResponse.redirect(new URL('/auth?tab=register', APP_URL));
  }

  let checkoutSession: Stripe.Checkout.Session;
  try {
    checkoutSession = await stripe().checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });
  } catch (err) {
    console.error('[stripe/success] retrieve failed', err);
    return NextResponse.redirect(new URL('/auth?stripe_error=1', APP_URL));
  }

  if (checkoutSession.status !== 'complete') {
    return NextResponse.redirect(new URL('/auth?tab=register', APP_URL));
  }

  const email = (
    checkoutSession.metadata?.email ??
    checkoutSession.customer_email ??
    ''
  ).toLowerCase();

  const plan = checkoutSession.metadata?.plan as PlanType | undefined;
  const customerId = typeof checkoutSession.customer === 'string'
    ? checkoutSession.customer
    : (checkoutSession.customer as Stripe.Customer | null)?.id ?? '';

  const sub = checkoutSession.subscription as Stripe.Subscription | null;

  if (!email || !plan) {
    console.error('[stripe/success] missing metadata', { email, plan });
    return NextResponse.redirect(new URL('/auth?stripe_error=1', APP_URL));
  }

  const user = await getUserByEmail(email);
  if (!user) {
    return NextResponse.redirect(new URL('/auth?stripe_error=1', APP_URL));
  }

  // Upgrade plan
  user.plan             = plan;
  user.stripeCustomerId = customerId;
  if (sub?.id) user.stripeSubscriptionId = sub.id;
  if (plan === 'abo' || plan === 'yearly') delete user.accessUntil;

  const isNewAccount = user.status === 'pending' && !user.passwordHash.startsWith('$2');
  // For new accounts (registered via Stripe-first flow): keep pending until password is set
  // For existing upgraded accounts: activate immediately
  if (!isNewAccount) {
    user.status = 'active';
  }

  await updateUser(user);

  // Verwaiste Gruppe? Abonnierendes Mitglied wird neuer Owner
  if (user.status === 'active') {
    const revived = await reviveOrphanedGroup(user);
    user.groupRole = revived.groupRole;
  }

  // ── New account: send setup email ─────────────────────────────────────────
  if (user.status === 'pending') {
    const setupToken = randomBytes(32).toString('hex');
    await storeSetupToken(setupToken, email);

    try {
      await sendAccountSetupEmail(user.firstName, email, setupToken);
    } catch (e) {
      console.error('[stripe/success] setup email failed', e);
    }

    return NextResponse.redirect(new URL('/auth?setup=1', APP_URL));
  }

  // ── Existing account upgrade: re-issue JWT and send to app ────────────────
  const token = await signToken({
    email:     user.email,
    plan:      user.plan,
    status:    user.status,
    isAdmin:   user.email === ADMIN_EMAIL,
    groupId:   user.groupId,
    groupRole: user.groupRole,
  });

  const response = NextResponse.redirect(new URL('/app', APP_URL));
  response.headers.set('Set-Cookie', sessionCookieHeader(token));
  return response;
}
