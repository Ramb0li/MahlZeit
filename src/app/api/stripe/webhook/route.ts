// Stripe webhooks must NOT be JSON-parsed by Next.js — raw body needed for signature verification.
export const dynamic = 'force-dynamic';

import { NextResponse }       from 'next/server';
import Stripe                 from 'stripe';
import { getUserByEmail, updateUser } from '@/lib/users';
import type { PlanType }      from '@/lib/users';

function stripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

async function applyPlanUpgrade(email: string, plan: PlanType, customerId: string, subscriptionId?: string) {
  const user = await getUserByEmail(email);
  if (!user) {
    console.error('[stripe/webhook] user not found:', email);
    return;
  }
  user.plan               = plan;
  user.status             = 'active';
  user.stripeCustomerId   = customerId;
  if (subscriptionId) user.stripeSubscriptionId = subscriptionId;
  if (plan === 'abo' || plan === 'yearly') {
    // accessUntil is managed by Stripe subscription events — clear stale trial date
    delete user.accessUntil;
  }
  await updateUser(user);
}

async function applySubscriptionCancellation(customerId: string) {
  const { getAllUsers } = await import('@/lib/users');
  const users = await getAllUsers();
  const user = users.find(u => u.stripeCustomerId === customerId);
  if (!user) return;
  user.plan   = 'trial';
  user.status = 'inactive';
  delete user.stripeSubscriptionId;
  await updateUser(user);
}

export async function POST(request: Request) {
  const sig    = request.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !secret) {
    return NextResponse.json({ error: 'Webhook nicht konfiguriert.' }, { status: 400 });
  }

  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    console.error('[stripe/webhook] signature verification failed', err);
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.status !== 'complete') break;
        const email    = (session.metadata?.email ?? session.customer_email ?? '').toLowerCase();
        const plan     = session.metadata?.plan as PlanType | undefined;
        const customer = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? '';
        const subId    = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
        if (email && plan) {
          await applyPlanUpgrade(email, plan, customer, subId);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
        await applySubscriptionCancellation(customerId);
        break;
      }

      case 'customer.subscription.updated': {
        const sub    = event.data.object as Stripe.Subscription;
        if (sub.status === 'active') break; // still active, no action
        if (sub.status === 'canceled' || sub.status === 'unpaid' || sub.status === 'past_due') {
          const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
          await applySubscriptionCancellation(customerId);
        }
        break;
      }

      default:
        // Ignore unhandled events
        break;
    }
  } catch (err) {
    console.error('[stripe/webhook] handler error', err);
    return NextResponse.json({ error: 'Handler failed.' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
