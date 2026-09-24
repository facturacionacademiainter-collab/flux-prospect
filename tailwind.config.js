/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        flux: {
          50: '#f5f1fa',
          100: '#ebe3f4',
          200: '#d6c6e8',
          300: '#b89fd4',
          400: '#a283c3',
          500: '#8C68B1',
          600: '#7a559f',
          700: '#654584',
          800: '#4f3668',
          900: '#3a2850',
        },
        fondo: '#0d0a14',
      },
      fontFamily: {
        sans: ['Barlow', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
