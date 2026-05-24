export const dynamic = 'force-dynamic';

import { NextResponse }        from 'next/server';
import { clearCookieHeader }   from '@/lib/auth';

export async function POST() {
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
}
