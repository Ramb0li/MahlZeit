import { getRequestConfig } from 'next-intl/server';
import { routing }          from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !(routing.locales as readonly string[]).includes(locale)) {
    locale = routing.defaultLocale;
  }

  // DE ist immer die Basis; andere Sprachen überschreiben nur was vorhanden ist
  const [localeMessages, defaultMessages] = await Promise.all([
    import(`../../messages/${locale}.json`).then(m => m.default).catch(() => ({})),
    locale === 'de'
      ? Promise.resolve({})
      : import('../../messages/de.json').then(m => m.default),
  ]);

  // Deep-merge: DE als Basis, Locale-Strings überschreiben
  const messages = deepMerge(defaultMessages, localeMessages);

  return { locale, messages };
});

function deepMerge(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const key of Object.keys(override)) {
    const bv = base[key];
    const ov = override[key];
    if (isObject(bv) && isObject(ov)) {
      result[key] = deepMerge(bv as Record<string, unknown>, ov as Record<string, unknown>);
    } else {
      result[key] = ov;
    }
  }
  return result;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
