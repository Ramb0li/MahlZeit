import { type NextRequest, NextResponse } from 'next/server';
import createMiddleware                   from 'next-intl/middleware';
import { verifyToken, TOKEN_COOKIE, ADMIN_EMAIL } from '@/lib/auth';
import { routing }                               from '@/i18n/routing';

// next-intl Middleware: handhabt Locale-Detection und URL-Präfix-Redirects
const handleI18n = createMiddleware(routing);

// Locales als Set für O(1)-Lookup
const LOCALES = new Set<string>(routing.locales);

/** Extrahiert den Locale-Prefix aus dem Pfad (z.B. /de/app → 'de', /app → 'de' als Default) */
function getLocaleFromPath(pathname: string): string {
  const seg = pathname.split('/')[1];
  return LOCALES.has(seg) ? seg : routing.defaultLocale;
}

/** Gibt den Pfad ohne Locale-Prefix zurück (z.B. /de/app → /app) */
function stripLocale(pathname: string): string {
  const seg = pathname.split('/')[1];
  if (LOCALES.has(seg)) return pathname.slice(seg.length + 1) || '/';
  return pathname;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // API-Routes und Next.js-Internals direkt durchlassen
  if (pathname.startsWith('/api/') || pathname.startsWith('/_next/') || pathname.startsWith('/_vercel/')) {
    return NextResponse.next();
  }

  // Statische Assets durchlassen (Bilder, favicon etc.)
  if (/\.\w+$/.test(pathname)) {
    return NextResponse.next();
  }

  // Auth-Prüfung für geschützte Routen
  const stripped = stripLocale(pathname);
  const locale   = getLocaleFromPath(pathname);
  const isProtected = stripped.startsWith('/app') || stripped.startsWith('/admin');

  if (isProtected) {
    const token   = req.cookies.get(TOKEN_COOKIE)?.value;
    const session = token ? await verifyToken(token) : null;
    const url     = req.nextUrl.clone();

    // Nicht eingeloggt → /auth
    if (!session) {
      url.pathname = `/${locale}/auth`;
      url.searchParams.set('next', pathname);
      return NextResponse.redirect(url);
    }

    // /admin → nur ADMIN_EMAIL
    if (stripped.startsWith('/admin') && session.email !== ADMIN_EMAIL) {
      url.pathname = `/${locale}/app`;
      url.searchParams.delete('next');
      return NextResponse.redirect(url);
    }

    // Kein aktiver Account → /auth
    if (session.status !== 'active' && !stripped.startsWith('/admin')) {
      url.pathname = `/${locale}/auth`;
      url.searchParams.set('plan', session.plan);
      return NextResponse.redirect(url);
    }
  }

  // next-intl: Locale-Prefix hinzufügen / Sprache erkennen
  return handleI18n(req);
}

export const config = {
  // Alles ausser API, Next.js-Internals und statische Assets
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|manifest.json|images|Logo).*)'],
};
