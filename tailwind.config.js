/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Enable class-based dark mode
  theme: {
    extend: {
      colors: {
        cinema: {
          900: '#121212', // Base dark
          800: '#1E1E1E', // Secondary dark
          700: '#2D2D2D',
          gold: '#FFD700', // Gold accent
          amber: '#FFBF00', // Amber accent
        },
        theme: {
            bg: 'var(--bg-primary)',
            surface: 'var(--bg-secondary)',
            text: 'var(--text-primary)',
            subtext: 'var(--text-secondary)',
            accent: 'var(--accent-primary)',
            'accent-hover': 'var(--accent-secondary)',
            border: 'var(--border-color)',
            shadow: 'var(--shadow-color)',
        }
      },
      fontFamily: {
        sans: ['system-ui', 'sans-serif'],
        theme: ['var(--font-theme)', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-in-from-bottom-2': 'slideInFromBottom 0.3s ease-out',
        'flip': 'flip 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
        'spotlight': 'spotlight 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInFromBottom: {
          '0%': { transform: 'translateY(0.5rem)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        spotlight: {
            '0%, 100%': { opacity: '0.5', transform: 'scale(1)' },
            '50%': { opacity: '1', transform: 'scale(1.1)' },
        }
      },
      backgroundImage: {
        'curtain-gradient': 'linear-gradient(to right, #000000 0%, #1a1a1a 50%, #000000 100%)',
        'gold-gradient': 'linear-gradient(45deg, #FFD700, #FFBF00)',
      }
    },
  },
  plugins: [],
}
