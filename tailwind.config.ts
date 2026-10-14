import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/lib/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Be Vietnam Pro"', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        script: ['"Dancing Script"', '"Be Vietnam Pro"', 'cursive']
      },
      colors: {
        love: {
          50: '#fff1f6',
          100: '#ffe4ee',
          200: '#ffc9dd',
          300: '#ff9dbf',
          400: '#ff6b9d',
          500: '#ff3d7f',
          600: '#ed1e64',
          700: '#c81151',
          800: '#a31248',
          900: '#871342'
        }
      },
      keyframes: {
        'lb-float': {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-14px) rotate(3deg)' }
        },
        'lb-glow': {
          '0%, 100%': { opacity: '0.55', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.06)' }
        },
        'lb-shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        },
        'lb-fade-up': {
          '0%': { opacity: '0', transform: 'translateY(18px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        'lb-pop': {
          '0%': { opacity: '0', transform: 'scale(.92)' },
          '100%': { opacity: '1', transform: 'scale(1)' }
        },
        'lb-beat': {
          '0%, 100%': { transform: 'scale(1)' },
          '25%': { transform: 'scale(1.14)' },
          '45%': { transform: 'scale(.98)' },
          '60%': { transform: 'scale(1.08)' }
        }
      },
      animation: {
        'float-slow': 'lb-float 6s ease-in-out infinite',
        'float-fast': 'lb-float 4.2s ease-in-out infinite',
        glow: 'lb-glow 3s ease-in-out infinite',
        shimmer: 'lb-shimmer 2.6s linear infinite',
        'fade-up': 'lb-fade-up .6s cubic-bezier(.22,.8,.24,1) both',
        pop: 'lb-pop .28s cubic-bezier(.22,.8,.24,1) both',
        beat: 'lb-beat 1.6s ease-in-out infinite'
      }
    }
  },
  plugins: []
};

export default config;
