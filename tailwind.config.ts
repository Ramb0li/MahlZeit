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
        // Nadia Damaso palette — remapped onto the brand namespace
        // so existing `brand-green` usages automatically get terracotta
        brand: {
          green:        "#b5614a",   // terracotta accent
          "green-light":"#d4a090",   // dusty rose
          "green-dark": "#9a4f3c",   // deeper terracotta
          "green-50":   "#f2e5e0",   // light blush
          "green-100":  "#f5ece0",   // warm2-lt
          warm:         "#fff9f3",
          "warm-100":   "#f2e5e0",
          "warm-200":   "#e8dfd3",
          "warm-300":   "#d4a090",
        },
        nadia: {
          bg:           "#f7f4ee",
          bg2:          "#fff9f3",
          surface:      "#efe9df",
          surface2:     "#e8dfd3",
          accent:       "#b5614a",
          "accent-lt":  "#f2e5e0",
          "accent-md":  "#d4a090",
          warm2:        "#c49a6c",
          "warm2-lt":   "#f5ece0",
          text:         "#2c2420",
          text2:        "#5a4e48",
          muted:        "#9c8c84",
          border:       "#e0d8ce",
          border2:      "#d0c8be",
        },
      },
      fontFamily: {
        sans:      ["DM Sans", "system-ui", "sans-serif"],
        fraunces:  ["Fraunces", "serif"],
      },
    },
  },
  plugins: [],
};
export default config;
