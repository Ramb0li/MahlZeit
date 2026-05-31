import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, TOKEN_COOKIE, ADMIN_EMAIL } from '@/lib/auth';

export const config = {
  matcher: ['/app/:path*', '/admin/:path*'],
};

export async function middleware(req: NextRequest) {
  const token   = req.cookies.get(TOKEN_COOKIE)?.value;
  const session = token ? await verifyToken(token) : null;
  const url     = req.nextUrl.clone();

  // Not logged in → /auth
  if (!session) {
    url.pathname = '/auth';
    url.searchParams.set('next', req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // /admin → only ADMIN_EMAIL (info@o-v-k.ch)
  if (req.nextUrl.pathname.startsWith('/admin') && session.email !== ADMIN_EMAIL) {
    url.pathname = '/app';
    return NextResponse.redirect(url);
  }

  // No active access → /auth
  if (session.status !== 'active' && !req.nextUrl.pathname.startsWith('/admin')) {
    url.pathname = '/auth';
    url.searchParams.set('plan', session.plan);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}
