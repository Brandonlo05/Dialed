/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        dialed: {
          bg: '#000000',
          surface: '#0f0f14',
          card: 'rgba(255,255,255,0.06)',
          border: 'rgba(255,255,255,0.12)',
          accent: '#7c5cff',
          accentDim: '#5a3fd4',
          glow: '#a78bfa',
          stat: '#e8e6f3',
          muted: '#8b8798',
        },
      },
    },
  },
  plugins: [],
};
