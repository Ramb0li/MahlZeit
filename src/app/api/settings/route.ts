import { NextResponse } from 'next/server';
import { getSettings, saveSettings, getConstraints, saveConstraints } from '@/lib/data';

export async function GET() {
  try {
    const [settings, constraints] = await Promise.all([getSettings(), getConstraints()]);
    return NextResponse.json({ settings, constraints });
  } catch {
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { settings, constraints } = await request.json();
    await Promise.all([
      settings    ? saveSettings(settings)       : Promise.resolve(),
      constraints ? saveConstraints(constraints) : Promise.resolve(),
    ]);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Fehler beim Speichern' }, { status: 500 });
  }
}
