/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          50: '#14b8a6', // Secondary
          DEFAULT: '#0f766e', // Primary
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
          950: '#042f2e',
        },
        brand: {
          primary: '#0F766E',
          secondary: '#14B8A6',
          accent: '#F59E0B',
          success: '#22C55E',
          danger: '#EF4444',
          bg: '#F8FAFC',
          darkBg: '#0F172A',
          darkCard: '#1E293B',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
