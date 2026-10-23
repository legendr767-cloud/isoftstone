/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: { DEFAULT: '1rem', sm: '1.5rem', lg: '2rem' }, screens: { '2xl': '1280px' } },
    extend: {
      colors: {
        // Brand palette taken from the supplied iSoftStone logo
        ink: { 950: '#070D1A', 900: '#0B1220', 800: '#0F172A', 700: '#16213A', 600: '#1E293B', 500: '#334155' },
        brand: { 50: '#ECFDF5', 300: '#6EE7B7', 400: '#34D399', 500: '#10B981', 600: '#059669', 700: '#047857' },
        royal: { 500: '#2563EB', 600: '#1E40AF', 700: '#1E3A8A' },
        line: '#25324B',
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Montserrat Variable"', '"Inter Variable"', 'ui-sans-serif', 'sans-serif'],
      },
      boxShadow: { glow: '0 0 0 1px rgba(16,185,129,.25), 0 10px 40px -10px rgba(16,185,129,.35)', card: '0 1px 0 rgba(255,255,255,.03) inset, 0 12px 32px -16px rgba(0,0,0,.6)' },
      keyframes: { float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } } },
      animation: { float: 'float 7s ease-in-out infinite' },
    },
  },
  plugins: [],
};
