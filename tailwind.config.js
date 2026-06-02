/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary:       '#1a3a5c',
        'primary-light': '#2d5a8e',
        accent:        '#c9a84c',
        success:       '#2d7a4f',
        warning:       '#b8860b',
        danger:        '#c0392b',
        bg:            '#f8f9fa',
        'sidebar-bg':  '#1a3a5c',
        'sidebar-text':'#e8edf2',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
