export const dynamic = 'force-dynamic';

import { NextResponse }                  from 'next/server';
import { randomBytes }                   from 'crypto';
import bcrypt                            from 'bcryptjs';
import Stripe                            from 'stripe';
import { createUser, getUserByEmail, setConfirmationTokenIndex } from '@/lib/users';
import { sendConfirmationEmail }         from '@/lib/email';
import { createGroup, newGroupId }       from '@/lib/groups';
import type { PlanType, AppUser }        from '@/lib/users';

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function stripeClient() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

function priceId(plan: PlanType): string | null {
  if (plan === 'lifetime') return process.env.STRIPE_PRICE_LIFETIME ?? null;
  if (plan === 'yearly')   return process.env.STRIPE_PRICE_YEARLY   ?? null;
  if (plan === 'abo')      return process.env.STRIPE_PRICE_MONTHLY  ?? null;
  return null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      firstName?: string;
      lastName?:  string;
      email?:     string;
      password?:  string;
      plan?:      PlanType;
    };

    const { firstName, lastName, email, password, plan = 'trial' } = body;

    if (!firstName || !lastName || !email || !plan) {
      return NextResponse.json({ error: 'Alle Felder sind erforderlich.' }, { status: 400 });
    }

    const normalEmail = email.toLowerCase().trim();

    // ── Duplicate check ───────────────────────────────────────────────────────
    const existing = await getUserByEmail(normalEmail);
    if (existing && existing.status !== 'pending') {
      return NextResponse.json({ error: 'Diese E-Mail ist bereits registriert.' }, { status: 409 });
    }

    // ── Gruppe anlegen ────────────────────────────────────────────────────────
    const groupId = newGroupId();

    // ── PAID PLAN: Stripe-first (kein Passwort nötig) ─────────────────────────
    const isPaid = plan !== 'trial';

    if (isPaid) {
      const price = priceId(plan);
      if (!price) {
        return NextResponse.json({ error: 'Preis nicht konfiguriert.' }, { status: 500 });
      }

      // Temp-Passwort-Hash damit User-Objekt valide ist
      const tempHash = await bcrypt.hash(randomBytes(16).toString('hex'), 10);

      const user: AppUser = {
        id:           `u_${Date.now()}_${randomBytes(3).toString('hex')}`,
        firstName,
        lastName,
        email:        normalEmail,
        passwordHash: tempHash,
        plan,
        status:       'pending',
        registeredAt: new Date().toISOString(),
        groupId,
        groupRole:    'owner',
      };

      if (existing) {
        // Bereits als pending registriert — nur Plan + Namen aktualisieren, groupId behalten
        const { updateUser } = await import('@/lib/users');
        await updateUser({
          ...existing,
          firstName,
          lastName,
          plan,
          passwordHash: user.passwordHash,
        });
      } else {
        await createUser(user);
        await createGroup({
          id:         groupId,
          name:       `${firstName}s Familie`,
          nameSet:    false,
          ownerEmail: normalEmail,
          createdAt:  new Date().toISOString(),
        });
      }

      const appUrl = process.env.APP_URL ?? 'https://mahlzeit.o-v-k.ch';

      const session = await stripeClient().checkout.sessions.create({
        mode:                  plan === 'lifetime' ? 'payment' : 'subscription',
        customer_email:        normalEmail,
        line_items:            [{ price, quantity: 1 }],
        success_url:           `${appUrl}/api/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:            `${appUrl}/auth?tab=register`,
        metadata:              { plan, email: normalEmail },
        allow_promotion_codes: true,
      });

      return NextResponse.json({ stripeUrl: session.url }, { status: 201 });
    }

    // ── TRIAL: klassischer Flow mit Passwort + E-Mail-Bestätigung ─────────────
    if (!password || password.length < 8) {
      return NextResponse.json({ error: 'Passwort muss mindestens 8 Zeichen haben.' }, { status: 400 });
    }
    if (existing) {
      return NextResponse.json({ error: 'Diese E-Mail ist bereits registriert.' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const token        = randomBytes(32).toString('hex');
    const expiresAt    = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

    const user: AppUser = {
      id:                         `u_${Date.now()}_${randomBytes(3).toString('hex')}`,
      firstName,
      lastName,
      email:                      normalEmail,
      passwordHash,
      plan:                       'trial',
      status:                     'pending',
      registeredAt:               new Date().toISOString(),
      confirmationToken:          token,
      confirmationTokenExpiresAt: expiresAt,
      groupId,
      groupRole:                  'owner',
    };

    await createUser(user);
    await setConfirmationTokenIndex(token, user.email);
    await createGroup({
      id:         groupId,
      name:       `${firstName}s Familie`,
      nameSet:    false,
      ownerEmail: normalEmail,
      createdAt:  new Date().toISOString(),
    });

    try {
      await sendConfirmationEmail(user, token);
    } catch (e) {
      console.error('[register] Email-Versand fehlgeschlagen:', e);
    }

    return NextResponse.json({
      ok:                  true,
      pendingConfirmation: true,
      email:               user.email,
    }, { status: 201 });

  } catch (err) {
    console.error('[register]', err);
    return NextResponse.json({ error: 'Registrierung fehlgeschlagen.' }, { status: 500 });
  }
}
