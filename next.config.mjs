import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'www.meteoblue.com' },
    ],
  },

  // Die Locales fr/it/en wurden deaktiviert (siehe src/i18n/routing.ts).
  // Bereits geteilte Links auf die deutsche Fassung umleiten statt 404 zu liefern.
  async redirects() {
    return [
      { source: '/fr/:path*', destination: '/de/:path*', permanent: true },
      { source: '/it/:path*', destination: '/de/:path*', permanent: true },
      { source: '/en/:path*', destination: '/de/:path*', permanent: true },
      { source: '/fr',        destination: '/de',        permanent: true },
      { source: '/it',        destination: '/de',        permanent: true },
      { source: '/en',        destination: '/de',        permanent: true },
    ];
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Clickjacking-Schutz — die App wird nirgends eingebettet.
          { key: 'X-Frame-Options',        value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy',        value: 'strict-origin-when-cross-origin' },
          // Keine dieser Browser-APIs wird benötigt.
          { key: 'Permissions-Policy',     value: 'camera=(), microphone=(), geolocation=()' },
          // HSTS: greift nur über HTTPS, lokal also wirkungslos.
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          // CSP zunächst nur berichtend: die App nutzt an vielen Stellen
          // Inline-Styles, ein harter Modus würde das Layout brechen.
          // Vor dem Scharfschalten die Verstösse in der Browser-Konsole prüfen.
          {
            key: 'Content-Security-Policy-Report-Only',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://va.vercel-scripts.com https://vitals.vercel-insights.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
