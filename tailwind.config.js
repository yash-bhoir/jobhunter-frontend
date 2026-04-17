/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    screens: {
      'xs':  '480px',
      'sm':  '640px',
      'md':  '768px',
      'lg':  '1024px',
      'xl':  '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        primary: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'xs':   '0 1px 2px 0 rgba(0,0,0,0.04)',
        'card': '0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.04)',
        'elevated': '0 4px 16px -4px rgba(0,0,0,0.1), 0 2px 6px -2px rgba(0,0,0,0.06)',
        'modal': '0 20px 48px -8px rgba(0,0,0,0.18)',
      },
      animation: {
        'fade-in':     'fadeIn 0.2s ease-out',
        'fade-in-up':  'fadeInUp 0.22s ease-out',
        'scale-in':    'scaleIn 0.18s ease-out',
        'slide-up':    'slideUp 0.3s ease-out',
        'slide-in':    'slideIn 0.3s ease-out',
        'slide-left':  'slideLeft 0.25s ease-out',
      },
      keyframes: {
        fadeIn:    { from: { opacity: '0' }, to: { opacity: '1' } },
        fadeInUp:  { from: { opacity: '0', transform: 'translateY(10px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        scaleIn:   { from: { opacity: '0', transform: 'scale(0.96)' }, to: { opacity: '1', transform: 'scale(1)' } },
        slideUp:   { from: { transform: 'translateY(20px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        slideIn:   { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
        slideLeft: { from: { opacity: '0', transform: 'translateX(-12px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
