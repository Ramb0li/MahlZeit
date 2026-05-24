export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getWeatherCache, saveWeatherCache, getSettings } from '@/lib/data';
import { getWeatherTypeFromTemp } from '@/lib/utils';
import type { WeatherDay, WeatherCache } from '@/types';

function isStale(lastUpdated: string | null): boolean {
  if (!lastUpdated) return true;
  return Date.now() - new Date(lastUpdated).getTime() > 6 * 60 * 60 * 1000;
}

async function geocode(location: string): Promise<{ lat: number; lon: number; name: string } | null> {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=de&format=json`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = await resp.json();
    const result = data.results?.[0];
    if (!result) return null;
    return { lat: result.latitude, lon: result.longitude, name: result.name };
  } catch {
    return null;
  }
}

function wmoToCondition(code: number): { condition: WeatherDay['condition']; conditionLabel: string } {
  if (code === 0 || code === 1) return { condition: 'sunny',        conditionLabel: 'Sonnig' };
  if (code === 2)               return { condition: 'partly-cloudy', conditionLabel: 'Teils bewölkt' };
  if (code === 3 || code === 45 || code === 48) return { condition: 'cloudy', conditionLabel: 'Bewölkt' };
  if (code >= 71 && code <= 77) return { condition: 'snowy',  conditionLabel: 'Schnee' };
  if (code === 85 || code === 86) return { condition: 'snowy', conditionLabel: 'Schneeschauer' };
  if (code >= 51 && code <= 67) return { condition: 'rainy',  conditionLabel: 'Regen' };
  if (code >= 80 && code <= 82) return { condition: 'rainy',  conditionLabel: 'Regenschauer' };
  if (code >= 95)               return { condition: 'rainy',  conditionLabel: 'Gewitter' };
  return { condition: 'partly-cloudy', conditionLabel: 'Wechselhaft' };
}

function getFallbackWeather(location: string): WeatherCache {
  const today = new Date();
  const month = today.getMonth() + 1;
  const baseTemp = month <= 2 || month === 12 ? 4 : month <= 4 ? 12 : month <= 8 ? 22 : 14;
  const days: WeatherDay[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const tempMax = baseTemp + Math.floor(Math.random() * 5);
    const tempMin = tempMax - 6;
    return {
      date: d.toISOString().split('T')[0],
      tempMin, tempMax,
      condition: 'partly-cloudy' as WeatherDay['condition'],
      conditionLabel: 'Teils bewölkt',
      weatherType: getWeatherTypeFromTemp((tempMax + tempMin) / 2),
    };
  });
  return { lastUpdated: null, location: `${location} (Schätzung)`, days };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';

    const [cached, settings] = await Promise.all([getWeatherCache(), getSettings()]);

    if (!forceRefresh && !isStale(cached.lastUpdated) && cached.days.length > 0) {
      return NextResponse.json(cached);
    }

    const location = settings.weather?.location || 'Luzern';
    const geo = await geocode(location);
    if (!geo) return NextResponse.json(getFallbackWeather(location));

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${geo.lat}&longitude=${geo.lon}&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=Europe%2FBerlin&forecast_days=7`;
    const resp = await fetch(url);
    if (!resp.ok) return NextResponse.json(getFallbackWeather(location));

    const data = await resp.json();
    const daily = data.daily as Record<string, unknown[]> | undefined;
    if (!daily) return NextResponse.json(getFallbackWeather(location));

    const dates     = (daily.time                as string[]) ?? [];
    const tempMaxArr = (daily.temperature_2m_max as number[]) ?? [];
    const tempMinArr = (daily.temperature_2m_min as number[]) ?? [];
    const wmoCodes  = (daily.weathercode         as number[]) ?? [];

    const days: WeatherDay[] = dates.slice(0, 7).map((date, i) => {
      const tempMax = tempMaxArr[i] ?? 15;
      const tempMin = tempMinArr[i] ?? 10;
      const { condition, conditionLabel } = wmoToCondition(wmoCodes[i] ?? 0);
      return {
        date, tempMin: Math.round(tempMin), tempMax: Math.round(tempMax),
        condition, conditionLabel,
        weatherType: getWeatherTypeFromTemp((tempMax + tempMin) / 2),
      };
    });

    const weatherData: WeatherCache = { lastUpdated: new Date().toISOString(), location: geo.name, days };
    await saveWeatherCache(weatherData);
    return NextResponse.json(weatherData);
  } catch {
    return NextResponse.json(getFallbackWeather('Luzern'));
  }
}
