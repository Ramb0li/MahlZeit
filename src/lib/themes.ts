export type ThemeId = 'green' | 'warm' | 'bronze';

export interface DayCardColors {
  bg: string;
  textPrimary: string;
  textSecondary: string;
}

export interface AppTheme {
  id: ThemeId;
  label: string;
  description: string;
  previewColors: [string, string, string, string];
  isDark: boolean;
  pageBg: string;
  headerBg: string;
  pageText: string;
  pageSubtext: string;
  dayCards: [DayCardColors, DayCardColors, DayCardColors, DayCardColors, DayCardColors, DayCardColors, DayCardColors];
  todayAccent: string;
  todayRing: string;
  mealFilledBg: string;
  mealFilledText: string;
  mealLabelText: string;
  mealEmptyBg: string;
  mealEmptyBorder: string;
  mealBtnBg: string;
  mealBtnText: string;
  navBg: string;
  navActiveBg: string;
  navActiveText: string;
  navInactiveText: string;
  weekNavBg: string;
  weekNavText: string;
  weekNavHoverBg: string;
  borderColor: string;
  tagBg: string;
}

export const THEMES: Record<ThemeId, AppTheme> = {
  green: {
    id: 'green',
    label: 'Grün',
    description: 'Frisch & natürlich',
    previewColors: ['#DBE9D8', '#C8DFDA', '#C0DDCE', '#D4E8D2'],
    isDark: false,
    pageBg: '#FFFFFF',
    headerBg: '#FFFFFF',
    pageText: '#111827',
    pageSubtext: '#6B7280',
    dayCards: [
      { bg: '#DBE9D8', textPrimary: '#1C3828', textSecondary: '#4A7858' },
      { bg: '#C8DFDA', textPrimary: '#1A3430', textSecondary: '#3A6A60' },
      { bg: '#D4E8D2', textPrimary: '#1C3828', textSecondary: '#4A7858' },
      { bg: '#C8DED2', textPrimary: '#1A3828', textSecondary: '#3E6858' },
      { bg: '#D0E8E0', textPrimary: '#1A3430', textSecondary: '#3A6860' },
      { bg: '#C0DDCE', textPrimary: '#1A3428', textSecondary: '#386858' },
      { bg: '#D8ECD0', textPrimary: '#1C3828', textSecondary: '#4A7858' },
    ],
    todayAccent: '#3A8A58',
    todayRing: '#3A8A58',
    mealFilledBg: '#FFFFFF',
    mealFilledText: '#1F2937',
    mealLabelText: '#9CA3AF',
    mealEmptyBg: 'rgba(255,255,255,0.45)',
    mealEmptyBorder: 'rgba(255,255,255,0.9)',
    mealBtnBg: 'rgba(255,255,255,0.85)',
    mealBtnText: '#374151',
    navBg: '#F3F4F6',
    navActiveBg: '#FFFFFF',
    navActiveText: '#111827',
    navInactiveText: '#6B7280',
    weekNavBg: '#F3F4F6',
    weekNavText: '#6B7280',
    weekNavHoverBg: '#E5E7EB',
    borderColor: '#E5E7EB',
    tagBg: '#F3F4F6',
  },

  warm: {
    id: 'warm',
    label: 'Warm',
    description: 'Terracotta & Ocker',
    previewColors: ['#F5E6C8', '#EED8AC', '#EBD098', '#E8C8A0'],
    isDark: false,
    pageBg: '#FDFAF5',
    headerBg: '#FDFAF5',
    pageText: '#2C1A08',
    pageSubtext: '#7A5030',
    dayCards: [
      { bg: '#F5E6C8', textPrimary: '#3A2010', textSecondary: '#7A5030' },
      { bg: '#EED8AC', textPrimary: '#3A2010', textSecondary: '#7A5030' },
      { bg: '#EBD098', textPrimary: '#3A2010', textSecondary: '#7A5030' },
      { bg: '#F0DCBC', textPrimary: '#3A2010', textSecondary: '#7A5030' },
      { bg: '#EDD4B0', textPrimary: '#3A2010', textSecondary: '#7A5030' },
      { bg: '#F5E8D0', textPrimary: '#3A2010', textSecondary: '#7A5030' },
      { bg: '#E8D8B4', textPrimary: '#3A2010', textSecondary: '#7A5030' },
    ],
    todayAccent: '#B84820',
    todayRing: '#B84820',
    mealFilledBg: '#FFFFFF',
    mealFilledText: '#3A2010',
    mealLabelText: '#A07848',
    mealEmptyBg: 'rgba(255,255,255,0.45)',
    mealEmptyBorder: 'rgba(255,255,255,0.9)',
    mealBtnBg: 'rgba(255,255,255,0.85)',
    mealBtnText: '#5A3820',
    navBg: '#EDE0C8',
    navActiveBg: '#FFFFFF',
    navActiveText: '#3A2010',
    navInactiveText: '#7A5030',
    weekNavBg: '#EDE0C8',
    weekNavText: '#7A5030',
    weekNavHoverBg: '#E0D0B4',
    borderColor: '#DDD0B0',
    tagBg: '#EDE0C8',
  },

  bronze: {
    id: 'bronze',
    label: 'Bronze',
    description: 'Dunkel & elegant',
    previewColors: ['#3D3222', '#4A3C26', '#302A18', '#3A2E1C'],
    isDark: true,
    pageBg: '#18140E',
    headerBg: '#18140E',
    pageText: '#EAE0CE',
    pageSubtext: '#A89870',
    dayCards: [
      { bg: '#3D3222', textPrimary: '#EAE0CE', textSecondary: '#A89870' },
      { bg: '#302A18', textPrimary: '#EAE0CE', textSecondary: '#A89870' },
      { bg: '#4A3C26', textPrimary: '#EAE0CE', textSecondary: '#A89870' },
      { bg: '#352C1A', textPrimary: '#EAE0CE', textSecondary: '#A89870' },
      { bg: '#3F3218', textPrimary: '#EAE0CE', textSecondary: '#A89870' },
      { bg: '#2C2818', textPrimary: '#EAE0CE', textSecondary: '#A89870' },
      { bg: '#3A2E1C', textPrimary: '#EAE0CE', textSecondary: '#A89870' },
    ],
    todayAccent: '#C8A850',
    todayRing: '#C8A850',
    mealFilledBg: '#2A2218',
    mealFilledText: '#EAE0CE',
    mealLabelText: '#A89870',
    mealEmptyBg: 'rgba(255,255,255,0.05)',
    mealEmptyBorder: 'rgba(255,255,255,0.12)',
    mealBtnBg: 'rgba(255,255,255,0.08)',
    mealBtnText: '#D4C8A8',
    navBg: '#242018',
    navActiveBg: '#3D3222',
    navActiveText: '#EAE0CE',
    navInactiveText: '#A89870',
    weekNavBg: '#242018',
    weekNavText: '#A89870',
    weekNavHoverBg: '#302A18',
    borderColor: '#3A3020',
    tagBg: '#2A2418',
  },
};

export const DEFAULT_THEME: ThemeId = 'green';
export const getTheme = (id?: ThemeId): AppTheme => THEMES[id ?? DEFAULT_THEME];
