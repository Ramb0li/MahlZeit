export const dynamic = 'force-dynamic';

import { NextResponse }                           from 'next/server';
import bcrypt                                     from 'bcryptjs';
import { ADMIN_EMAIL, signToken, sessionCookieHeader } from '@/lib/auth';
import { createUser, getUserByEmail }             from '@/lib/users';
import type { PlanType }                          from '@/lib/users';

export async function POST(request: Request) {
  try {
    const { firstName, lastName, email, password, plan } = await request.json() as {
      firstName: string;
      lastName:  string;
      email:     string;
      password:  string;
      plan:      PlanType;
    };

    // Validation
    if (!firstName || !lastName || !email || !password || !plan) {
      return NextResponse.json({ error: 'Alle Felder sind erforderlich.' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Passwort muss mindestens 8 Zeichen haben.' }, { status: 400 });
    }

    // Check duplicate
    const existing = await getUserByEmail(email);
    if (existing) {
      return NextResponse.json({ error: 'Diese E-Mail ist bereits registriert.' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Trial: immediately active for 7 days; others: pending until Stripe payment
    const isTrial    = plan === 'trial';
    const status     = isTrial ? 'active' : 'pending';
    const accessUntil = isTrial
      ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      : undefined;

    const user = {
      id:           `u_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      firstName,
      lastName,
      email:        email.toLowerCase(),
      passwordHash,
      plan,
      status,
      registeredAt: new Date().toISOString(),
      ...(accessUntil ? { accessUntil } : {}),
    } as const;

    await createUser(user);

    // If trial, sign in immediately
    if (isTrial) {
      const token = await signToken({
        email: user.email,
        plan,
        status: 'active',
        isAdmin: user.email === ADMIN_EMAIL,
      });
      return new NextResponse(
        JSON.stringify({ redirect: '/app' }),
        {
          status: 201,
          headers: {
            'Content-Type': 'application/json',
            'Set-Cookie': sessionCookieHeader(token),
          },
        }
      );
    }

    // Paid plan → create Stripe checkout
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://mahlzeit.o-v-k.ch';
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      // No Stripe configured yet – still return the user id so frontend can show a message
      return NextResponse.json(
        { redirect: `/auth?pending=1&email=${encodeURIComponent(user.email)}` },
        { status: 201 }
      );
    }

    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(stripeKey);

    const priceId =
      plan === 'lifetime'
        ? process.env.STRIPE_PRICE_LIFETIME
        : process.env.STRIPE_PRICE_MONTHLY;

    if (!priceId) {
      return NextResponse.json({ error: 'Stripe-Preis nicht konfiguriert.' }, { status: 500 });
    }

    const session = await stripe.checkout.sessions.create({
      mode:           plan === 'lifetime' ? 'payment' : 'subscription',
      customer_email: user.email,
      line_items:     [{ price: priceId, quantity: 1 }],
      metadata:       { userId: user.id, plan },
      success_url:    `${appUrl}/app?payment=success`,
      cancel_url:     `${appUrl}/auth?payment=cancelled`,
    });

    return NextResponse.json({ stripeUrl: session.url }, { status: 201 });
  } catch (err) {
    console.error('[register]', err);
    return NextResponse.json({ error: 'Registrierung fehlgeschlagen.' }, { status: 500 });
  }
}
