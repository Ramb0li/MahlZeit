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
        brand: {
          green: "#4CAF50",
          "green-light": "#81C784",
          "green-dark": "#388E3C",
          "green-50": "#F1F8E9",
          "green-100": "#DCEDC8",
          warm: "#FFF8F0",
          "warm-100": "#FFF3E0",
          "warm-200": "#FFE0B2",
          "warm-300": "#FFCC80",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
