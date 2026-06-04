export const dynamic = 'force-dynamic';

import { NextResponse }     from 'next/server';
import Stripe               from 'stripe';
import { getSession }       from '@/lib/auth';
import { getUserByEmail }   from '@/lib/users';

type CheckoutPlan = 'abo' | 'yearly' | 'lifetime';

function stripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

function priceId(plan: CheckoutPlan): string {
  if (plan === 'lifetime') return process.env.STRIPE_PRICE_LIFETIME!;
  if (plan === 'yearly')   return process.env.STRIPE_PRICE_YEARLY!;
  return process.env.STRIPE_PRICE_MONTHLY!;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });
  }

  let plan: CheckoutPlan;
  try {
    const body = await request.json() as { plan?: string };
    if (!body.plan || !['abo', 'yearly', 'lifetime'].includes(body.plan)) {
      return NextResponse.json({ error: 'Ungültiger Plan.' }, { status: 400 });
    }
    plan = body.plan as CheckoutPlan;
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 });
  }

  const price = priceId(plan);
  if (!price) {
    return NextResponse.json({ error: 'Preis nicht konfiguriert.' }, { status: 500 });
  }

  const appUrl = process.env.APP_URL ?? 'https://mahlzeit.o-v-k.ch';

  const user = await getUserByEmail(session.email);

  try {
    const checkoutSession = await stripe().checkout.sessions.create({
      mode:               plan === 'lifetime' ? 'payment' : 'subscription',
      customer_email:     user?.stripeCustomerId ? undefined : session.email,
      customer:           user?.stripeCustomerId ?? undefined,
      line_items: [{ price, quantity: 1 }],
      success_url:        `${appUrl}/api/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:         `${appUrl}/app?tab=settings`,
      metadata:           { plan, email: session.email },
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    console.error('[stripe/checkout]', err);
    return NextResponse.json({ error: 'Stripe-Fehler.' }, { status: 500 });
  }
}
