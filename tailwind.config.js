/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'sans-serif'],
      },
      colors: {
        navy: '#0b2140',
        'navy-deep': '#081a33',
        blue: '#006fff',
        'blue-bright': '#005ce6',
        'blue-soft': '#eaf2ff',
        ink: '#0b2140',
        muted: '#5f7391',
        line: 'rgba(11, 33, 64, 0.12)',
        surface: '#ffffff',
        'surface-2': '#f3f6fb',
      },
    },
  },
  plugins: [],
}
