'use client';
import { Sun, Cloud, CloudRain, CloudSnow, CloudSun } from 'lucide-react';
import type { WeatherDay } from '@/types';

interface WeatherIconProps {
  condition: WeatherDay['condition'];
  size?: number;
  className?: string;
}

export function WeatherIcon({ condition, size = 18, className }: WeatherIconProps) {
  const props = { size, className };
  switch (condition) {
    case 'sunny': return <Sun {...props} className={`text-yellow-500 ${className ?? ''}`} />;
    case 'partly-cloudy': return <CloudSun {...props} className={`text-yellow-400 ${className ?? ''}`} />;
    case 'cloudy': return <Cloud {...props} className={`text-gray-400 ${className ?? ''}`} />;
    case 'rainy': return <CloudRain {...props} className={`text-blue-400 ${className ?? ''}`} />;
    case 'snowy': return <CloudSnow {...props} className={`text-blue-200 ${className ?? ''}`} />;
    default: return <Cloud {...props} className={`text-gray-400 ${className ?? ''}`} />;
  }
}
