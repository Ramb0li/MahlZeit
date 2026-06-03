// Theme IDs — neue + alte (backward compat für gespeicherte Nutzerdaten)
export type ThemeId = 'ivory' | 'espresso' | 'sage' | 'night' | 'green' | 'warm' | 'bronze';

export interface ThemeDef {
  id: ThemeId;
  dataTheme: string;
  label: string;
  mode: 'Tag' | 'Dunkel';
  previewBg: string;
  accentColor: string;
}

export const THEME_DEFS: ThemeDef[] = [
  { id: 'ivory',    dataTheme: 'ivory',    label: 'Ivory',    mode: 'Tag',    previewBg: '#faf7f2', accentColor: '#c0533f' },
  { id: 'sage',     dataTheme: 'sage',     label: 'Salbei',   mode: 'Tag',    previewBg: '#f2f6f0', accentColor: '#4a7a4e' },
  { id: 'espresso', dataTheme: 'espresso', label: 'Espresso', mode: 'Dunkel', previewBg: '#1c1510', accentColor: '#c49a6c' },
  { id: 'night',    dataTheme: 'night',    label: 'Night',    mode: 'Dunkel', previewBg: '#12111a', accentColor: '#8b9cf4' },
];

// Mappt alte und neue ThemeIds auf das data-theme Attribut
export function toDataTheme(id: ThemeId | string | undefined): string {
  switch (id) {
    case 'green':    return 'ivory';
    case 'warm':     return 'ivory';
    case 'bronze':   return 'espresso';
    case 'ivory':    return 'ivory';
    case 'espresso': return 'espresso';
    case 'sage':     return 'sage';
    case 'night':    return 'night';
    default:         return 'ivory';
  }
}

export const DEFAULT_THEME: ThemeId = 'ivory';
