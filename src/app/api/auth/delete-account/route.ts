export const dynamic = 'force-dynamic';

import { NextResponse }                   from 'next/server';
import bcrypt                             from 'bcryptjs';
import Stripe                             from 'stripe';
import { getSession, clearCookieHeader }  from '@/lib/auth';
import { getUserByEmail, getUsersByGroup, deleteUser } from '@/lib/users';
import { getGroupById, updateGroup }      from '@/lib/groups';
import { sendGroupOrphanedEmail }         from '@/lib/email';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });
    }

    const { password } = await request.json() as { password?: string };
    if (!password) {
      return NextResponse.json({ error: 'Passwort erforderlich.' }, { status: 400 });
    }

    const user = await getUserByEmail(session.email);
    if (!user) {
      return NextResponse.json({ error: 'Konto nicht gefunden.' }, { status: 404 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: 'Falsches Passwort.' }, { status: 401 });
    }

    // Aktives Stripe-Abo kündigen, damit keine weiteren Zahlungen anfallen
    if (user.stripeSubscriptionId && process.env.STRIPE_SECRET_KEY) {
      try {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        await stripe.subscriptions.cancel(user.stripeSubscriptionId);
      } catch (e) {
        console.error('[delete-account] Stripe-Kündigung fehlgeschlagen:', e);
        // Konto-Löschung trotzdem fortsetzen — Abo kann manuell gekündigt werden
      }
    }

    // Owner: Gruppe als verwaist markieren (Rezepte/Pläne bleiben 30 Tage erhalten),
    // alle Mitglieder per E-Mail informieren.
    if (user.groupId && user.groupRole === 'owner') {
      const group = await getGroupById(user.groupId);
      if (group) {
        await updateGroup({
          ...group,
          orphaned:         true,
          orphanedAt:       new Date().toISOString(),
          formerOwnerEmail: user.email,
        });

        const members = (await getUsersByGroup(user.groupId))
          .filter(m => m.email.toLowerCase() !== user.email.toLowerCase());
        for (const m of members) {
          try {
            await sendGroupOrphanedEmail(m.firstName, m.email, group.name);
          } catch (e) {
            console.error('[delete-account] Info-Mail an Mitglied fehlgeschlagen:', m.email, e);
          }
        }
      }
    }

    await deleteUser(user.email);

    return new NextResponse(
      JSON.stringify({ ok: true }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': clearCookieHeader(),
        },
      }
    );
  } catch (err) {
    console.error('[delete-account]', err);
    return NextResponse.json({ error: 'Konto-Löschung fehlgeschlagen.' }, { status: 500 });
  }
}
