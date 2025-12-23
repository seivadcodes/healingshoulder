// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}', // includes app/, components/, etc.
  ],
  theme: {
    extend: {},
  },
  plugins: [
    require('tailwindcss-animate'), // ← This enables animations (ShadCN needs this)
  ],
};

export default config;