import { NextResponse } from 'next/server';
import { getWeekPlan, saveWeekPlan } from '@/lib/data';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const weekId = searchParams.get('weekId');
    if (!weekId) return NextResponse.json({ error: 'weekId fehlt' }, { status: 400 });
    const plan = await getWeekPlan(weekId);
    return NextResponse.json(plan ?? { weekId, startDate: '', days: {} });
  } catch {
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const weekId = searchParams.get('weekId');
    if (!weekId) return NextResponse.json({ error: 'weekId fehlt' }, { status: 400 });
    const empty = { weekId, startDate: '', days: {} };
    await saveWeekPlan(empty);
    return NextResponse.json(empty);
  } catch {
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { weekId, day, mealType, slot } = await request.json();
    if (!weekId || day === undefined || !mealType) {
      return NextResponse.json({ error: 'Fehlende Parameter' }, { status: 400 });
    }

    let plan = await getWeekPlan(weekId);
    if (!plan) plan = { weekId, startDate: '', days: {} };

    if (!plan.days[day]) {
      plan.days[day] = { dinner: { recipeId: null }, showLunch: false };
    }

    if (mealType === 'dinner')        plan.days[day].dinner   = slot;
    else if (mealType === 'lunch')    plan.days[day].lunch    = slot;
    else if (mealType === 'showLunch') plan.days[day].showLunch = slot;

    await saveWeekPlan(plan);
    return NextResponse.json(plan);
  } catch {
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}
