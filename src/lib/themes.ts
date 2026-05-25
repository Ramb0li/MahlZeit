export type ThemeId = 'green' | 'warm' | 'bronze' | 'sage';

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

// ── Nadia Damaso palette ────────────────────────────────────────────────────
//   --bg: #f7f4ee  --bg2: #fff9f3  --surface: #efe9df  --surface2: #e8dfd3
//   --accent: #b5614a  --accent-lt: #f2e5e0  --accent-md: #d4a090
//   --warm2: #c49a6c  --warm2-lt: #f5ece0
//   --text: #2c2420  --text2: #5a4e48  --muted: #9c8c84
//   --border: #e0d8ce  --border2: #d0c8be

export const THEMES: Record<ThemeId, AppTheme> = {

  // ── Ivory — warm primary theme ────────────────────────────────────────────
  green: {
    id: 'green',
    label: 'Ivory',
    description: 'Warm & terracotta',
    previewColors: ['#f2e5e0', '#efe9df', '#f5ece0', '#b5614a'],
    isDark: false,
    pageBg:      '#f7f4ee',
    headerBg:    '#f7f4ee',
    pageText:    '#2c2420',
    pageSubtext: '#9c8c84',
    dayCards: [
      { bg: '#f2e5e0', textPrimary: '#2c2420', textSecondary: '#9c8c84' },  // Mo blush
      { bg: '#f5ece0', textPrimary: '#2c2420', textSecondary: '#9c8c84' },  // Di warm2-lt
      { bg: '#efe9df', textPrimary: '#2c2420', textSecondary: '#9c8c84' },  // Mi surface
      { bg: '#f2e5e0', textPrimary: '#2c2420', textSecondary: '#9c8c84' },  // Do blush
      { bg: '#e8dfd3', textPrimary: '#2c2420', textSecondary: '#9c8c84' },  // Fr surface2
      { bg: '#f5ece0', textPrimary: '#2c2420', textSecondary: '#9c8c84' },  // Sa warm2-lt
      { bg: '#fff9f3', textPrimary: '#2c2420', textSecondary: '#9c8c84' },  // So bg2
    ],
    todayAccent:    '#b5614a',
    todayRing:      '#b5614a',
    mealFilledBg:   '#fff9f3',
    mealFilledText: '#2c2420',
    mealLabelText:  '#c49a6c',
    mealEmptyBg:    'rgba(242,229,224,0.55)',
    mealEmptyBorder:'#d4a090',
    mealBtnBg:      '#fff9f3',
    mealBtnText:    '#5a4e48',
    navBg:          '#efe9df',
    navActiveBg:    '#f2e5e0',
    navActiveText:  '#b5614a',
    navInactiveText:'#9c8c84',
    weekNavBg:      '#efe9df',
    weekNavText:    '#9c8c84',
    weekNavHoverBg: '#e8dfd3',
    borderColor:    '#e0d8ce',
    tagBg:          '#f2e5e0',
  },

  // ── Rosé — dusty rose & caramel variant ──────────────────────────────────
  warm: {
    id: 'warm',
    label: 'Rosé',
    description: 'Dusty rose & caramel',
    previewColors: ['#edd8c8', '#e0d0c0', '#c49a6c', '#b5614a'],
    isDark: false,
    pageBg:      '#f0e8df',
    headerBg:    '#f0e8df',
    pageText:    '#2c2420',
    pageSubtext: '#9c8c84',
    dayCards: [
      { bg: '#e8ddd0', textPrimary: '#2c2420', textSecondary: '#9c8c84' },
      { bg: '#edd8c8', textPrimary: '#2c2420', textSecondary: '#9c8c84' },
      { bg: '#e0d0c0', textPrimary: '#2c2420', textSecondary: '#9c8c84' },
      { bg: '#e8ddd0', textPrimary: '#2c2420', textSecondary: '#9c8c84' },
      { bg: '#ddd0c0', textPrimary: '#2c2420', textSecondary: '#9c8c84' },
      { bg: '#edd8c8', textPrimary: '#2c2420', textSecondary: '#9c8c84' },
      { bg: '#f5ece0', textPrimary: '#2c2420', textSecondary: '#9c8c84' },
    ],
    todayAccent:    '#b5614a',
    todayRing:      '#b5614a',
    mealFilledBg:   '#faf5ee',
    mealFilledText: '#2c2420',
    mealLabelText:  '#c49a6c',
    mealEmptyBg:    'rgba(212,160,144,0.2)',
    mealEmptyBorder:'#c49a6c',
    mealBtnBg:      '#faf5ee',
    mealBtnText:    '#5a4e48',
    navBg:          '#e0d8ce',
    navActiveBg:    '#f2e5e0',
    navActiveText:  '#b5614a',
    navInactiveText:'#9c8c84',
    weekNavBg:      '#e0d8ce',
    weekNavText:    '#9c8c84',
    weekNavHoverBg: '#d0c8be',
    borderColor:    '#d0c8be',
    tagBg:          '#f2e5e0',
  },

  // ── Espresso — warm dark variant ─────────────────────────────────────────
  bronze: {
    id: 'bronze',
    label: 'Espresso',
    description: 'Dunkel & warm',
    previewColors: ['#2c2218', '#3d2e22', '#4a3828', '#c49a6c'],
    isDark: true,
    pageBg:      '#1c1510',
    headerBg:    '#1c1510',
    pageText:    '#ede5d8',
    pageSubtext: '#9c8c84',
    dayCards: [
      { bg: '#2c2218', textPrimary: '#ede5d8', textSecondary: '#9c8c84' },
      { bg: '#261e14', textPrimary: '#ede5d8', textSecondary: '#9c8c84' },
      { bg: '#342a1e', textPrimary: '#ede5d8', textSecondary: '#9c8c84' },
      { bg: '#2c2218', textPrimary: '#ede5d8', textSecondary: '#9c8c84' },
      { bg: '#201a10', textPrimary: '#ede5d8', textSecondary: '#9c8c84' },
      { bg: '#342a1e', textPrimary: '#ede5d8', textSecondary: '#9c8c84' },
      { bg: '#2c2218', textPrimary: '#ede5d8', textSecondary: '#9c8c84' },
    ],
    todayAccent:    '#c49a6c',
    todayRing:      '#c49a6c',
    mealFilledBg:   '#261e14',
    mealFilledText: '#ede5d8',
    mealLabelText:  '#c49a6c',
    mealEmptyBg:    'rgba(255,255,255,0.05)',
    mealEmptyBorder:'rgba(255,255,255,0.15)',
    mealBtnBg:      'rgba(255,255,255,0.08)',
    mealBtnText:    '#c49a6c',
    navBg:          '#261e14',
    navActiveBg:    '#3d2e22',
    navActiveText:  '#ede5d8',
    navInactiveText:'#9c8c84',
    weekNavBg:      '#261e14',
    weekNavText:    '#9c8c84',
    weekNavHoverBg: '#342a1e',
    borderColor:    '#3d2e22',
    tagBg:          '#2c2218',
  },

  // ── Salbei — sage green, fresh & healthy ─────────────────────────────────
  sage: {
    id: 'sage',
    label: 'Salbei',
    description: 'Frisch & naturgrün',
    previewColors: ['#e8f2e8', '#c5dbc5', '#8fb88f', '#4a7a4e'],
    isDark: false,
    pageBg:      '#f2f6f2',
    headerBg:    '#f2f6f2',
    pageText:    '#1e2d1e',
    pageSubtext: '#6b8c6b',
    dayCards: [
      { bg: '#e8f2e8', textPrimary: '#1e2d1e', textSecondary: '#6b8c6b' },
      { bg: '#dceadc', textPrimary: '#1e2d1e', textSecondary: '#6b8c6b' },
      { bg: '#e4ede4', textPrimary: '#1e2d1e', textSecondary: '#6b8c6b' },
      { bg: '#e8f2e8', textPrimary: '#1e2d1e', textSecondary: '#6b8c6b' },
      { bg: '#d4e6d4', textPrimary: '#1e2d1e', textSecondary: '#6b8c6b' },
      { bg: '#dceadc', textPrimary: '#1e2d1e', textSecondary: '#6b8c6b' },
      { bg: '#ecf4ec', textPrimary: '#1e2d1e', textSecondary: '#6b8c6b' },
    ],
    todayAccent:    '#4a7a4e',
    todayRing:      '#4a7a4e',
    mealFilledBg:   '#f4f9f4',
    mealFilledText: '#1e2d1e',
    mealLabelText:  '#6b9c6b',
    mealEmptyBg:    'rgba(197,219,197,0.45)',
    mealEmptyBorder:'#a8c8a8',
    mealBtnBg:      '#f4f9f4',
    mealBtnText:    '#3a6a3a',
    navBg:          '#d8e8d8',
    navActiveBg:    '#c5d9c5',
    navActiveText:  '#2a4a2a',
    navInactiveText:'#6b8c6b',
    weekNavBg:      '#d8e8d8',
    weekNavText:    '#6b8c6b',
    weekNavHoverBg: '#c5d9c5',
    borderColor:    '#c8dcc8',
    tagBg:          '#e8f2e8',
  },
};

export const DEFAULT_THEME: ThemeId = 'sage';
export const getTheme = (id?: ThemeId): AppTheme => THEMES[id ?? DEFAULT_THEME];
