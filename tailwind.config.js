/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#2563EB',
        'primary-soft': '#EEF4FF',
        strong: '#0F1F3D',
        text: '#33415C',
        muted: '#7A879F',
        line: '#E6EBF3',
        app: '#F7F9FC',
        success: '#16A34A',
        warning: '#F59E0B',
        danger: '#EF4444'
      },
      boxShadow: {
        soft: '0 4px 16px rgba(15, 31, 61, 0.06)'
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.22, 1, 0.36, 1)'
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        }
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
        'fade-in': 'fade-in 0.2s ease-out'
      }
    }
  },
  plugins: []
}
