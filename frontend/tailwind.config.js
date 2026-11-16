/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Cool "lab ink" neutrals. Every existing page uses slate-*, so
        // remapping it restyles the whole dashboard in one place.
        slate: {
          50: '#F4F6FB',
          100: '#E6EAF5',
          200: '#C9D0E3',
          300: '#A6B0CB',
          400: '#8792B0',
          500: '#66708E',
          600: '#4A5370',
          700: '#333B57',
          800: '#232A43',
          900: '#141A2D',
          950: '#0C1020',
        },
        // Specimen blue: actions and focus.
        blue: {
          300: '#A8B8FF',
          400: '#7F95FF',
          500: '#5C76FF',
          600: '#4561F5',
          700: '#3249D6',
          800: '#2738A8',
          900: '#1E2B7A',
          950: '#141C4F',
        },
        ink: '#090C17',
        beam: '#6BE4FF',
      },
      fontFamily: {
        sans: ['"Archivo Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono Variable"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [],
};
