import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg:           'var(--bg)',
        'bg-2':       'var(--bg-2)',
        card:         'var(--card)',
        ink:          'var(--ink)',
        'ink-2':      'var(--ink-2)',
        muted:        'var(--muted)',
        border:       'var(--border)',
        'border-2':   'var(--border-2)',
        chip:         'var(--chip)',
        accent:       'var(--accent)',
        'accent-ink': 'var(--accent-ink)',
        'accent-tint':'var(--accent-tint)',
        sage:         'var(--sage)',
        leaf:         'var(--leaf)',
      },
      fontFamily: {
        sans:     ['var(--font-ui)', 'DM Sans', 'system-ui', 'sans-serif'],
        display:  ['var(--font-display)', 'Fraunces', 'serif'],
        fraunces: ['var(--font-display)', 'Fraunces', 'serif'],
      },
    },
  },
  plugins: [],
};
export default config;
