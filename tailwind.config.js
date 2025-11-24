/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        'navy': '#0a1929',
        'navy-light': '#1a2332',
        'accent-orange': '#ff8c42',
        'border-dark': '#000000',
        'text-primary': '#ffffff',
      },
      backgroundColor: {
        'navy': '#0a1929',
        'navy-light': '#1a2332',
      },
      borderColor: {
        'dark': '#000000',
      },
      textColor: {
        'primary': '#ffffff',
      },
    },
    fontFamily: {
      sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'sans-serif'],
    },
  },
  plugins: [],
}


