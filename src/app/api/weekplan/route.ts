export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSessionWithGroup as getSession } from '@/lib/session';
import { getWeekPlan, saveWeekPlan } from '@/lib/data';

async function requireGroup() {
  const session = await getSession();
  if (!session)         return { error: NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 }) };
  if (!session.groupId) return { error: NextResponse.json({ error: 'Keine Gruppe zugeordnet' }, { status: 403 }) };
  return { groupId: session.groupId };
}

export async function GET(request: Request) {
  try {
    const gate = await requireGroup();
    if ('error' in gate) return gate.error;
    const { searchParams } = new URL(request.url);
    const weekId = searchParams.get('weekId');
    if (!weekId) return NextResponse.json({ error: 'weekId fehlt' }, { status: 400 });
    const plan = await getWeekPlan(weekId, gate.groupId);
    return NextResponse.json(plan ?? { weekId, startDate: '', days: {} });
  } catch {
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const gate = await requireGroup();
    if ('error' in gate) return gate.error;
    const { searchParams } = new URL(request.url);
    const weekId = searchParams.get('weekId');
    if (!weekId) return NextResponse.json({ error: 'weekId fehlt' }, { status: 400 });
    const empty = { weekId, startDate: '', days: {} };
    await saveWeekPlan(empty, gate.groupId);
    return NextResponse.json(empty);
  } catch {
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const gate = await requireGroup();
    if ('error' in gate) return gate.error;
    const { weekId, day, mealType, slot, toggleConstraintId, note } = await request.json();
    if (!weekId) return NextResponse.json({ error: 'weekId fehlt' }, { status: 400 });

    let plan = await getWeekPlan(weekId, gate.groupId);
    if (!plan) plan = { weekId, startDate: '', days: {} };

    if (toggleConstraintId) {
      const ids = plan.disabledConstraintIds ?? [];
      plan.disabledConstraintIds = ids.includes(toggleConstraintId)
        ? ids.filter(id => id !== toggleConstraintId)
        : [...ids, toggleConstraintId];
      await saveWeekPlan(plan, gate.groupId);
      return NextResponse.json(plan);
    }

    // Tagesnotiz speichern (kein mealType-Pflichtfeld)
    if (mealType === 'note') {
      if (day === undefined) return NextResponse.json({ error: 'day fehlt' }, { status: 400 });
      if (!plan.days[day]) plan.days[day] = { dinner: { recipeId: null }, showLunch: false };
      plan.days[day].note = typeof note === 'string' ? note : '';
      await saveWeekPlan(plan, gate.groupId);
      return NextResponse.json(plan);
    }

    if (day === undefined || !mealType) {
      return NextResponse.json({ error: 'Fehlende Parameter' }, { status: 400 });
    }

    if (!plan.days[day]) {
      plan.days[day] = { dinner: { recipeId: null }, showLunch: false };
    }

    if (mealType === 'dinner')          plan.days[day].dinner    = slot;
    else if (mealType === 'lunch')      plan.days[day].lunch     = slot;
    else if (mealType === 'breakfast')  plan.days[day].breakfast = slot;
    else if (mealType === 'showLunch')  plan.days[day].showLunch = slot;

    await saveWeekPlan(plan, gate.groupId);
    return NextResponse.json(plan);
  } catch {
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}
