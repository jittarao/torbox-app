/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#6366f1', // Indigo 500
          foreground: '#ffffff',
          border: '#e2e8f0', // Slate 200
          hover: '#4f46e5', // Indigo 600
          text: {
            DEFAULT: '#1e293b', // Slate 800
            dark: '#f8fafc', // Slate 50
          },
        },
        accent: {
          DEFAULT: '#f59e0b', // Amber 500
          dark: '#fbbf24', // Amber 400
          hover: '#d97706', // Amber 600
        },
        surface: {
          DEFAULT: '#ffffff',
          dark: '#0f172a', // Slate 900
          alt: {
            DEFAULT: '#f1f5f9', // Slate 100
            dark: '#1e293b', // Slate 800
            hover: {
              DEFAULT: '#e2e8f0', // Slate 200
              dark: '#334155', // Slate 700
            },
            selected: {
              DEFAULT: '#eef2ff', // Indigo 50
              dark: '#312e81', // Indigo 900
              hover: {
                DEFAULT: '#e0e7ff', // Indigo 100
                dark: '#3730a3', // Indigo 800
              },
            },
          },
          hover: {
            DEFAULT: '#f8fafc', // Slate 50
            dark: '#1e293b', // Slate 800
          },
        },
        border: {
          DEFAULT: '#e2e8f0', // Slate 200
          dark: '#334155', // Slate 700
        },
        label: {
          success: {
            text: '#15803d', // Green 700
            'text-dark': '#4ade80', // Green 400
            bg: '#f0fdf4', // Green 50
            'bg-dark': '#064e3b', // Green 900
          },
          danger: {
            text: '#b91c1c', // Red 700
            'text-dark': '#f87171', // Red 400
            bg: '#fef2f2', // Red 50
            'bg-dark': '#7f1d1d', // Red 900
          },
          warning: {
            text: '#a16207', // Amber 700
            'text-dark': '#fbbf24', // Amber 400
            bg: '#fffbeb', // Amber 50
            'bg-dark': '#78350f', // Amber 900
          },
          active: {
            text: '#1d4ed8', // Blue 700
            'text-dark': '#60a5fa', // Blue 400
            bg: '#eff6ff', // Blue 50
            'bg-dark': '#1e3a8a', // Blue 900
          },
          default: {
            text: '#475569', // Slate 600
            'text-dark': '#94a3b8', // Slate 400
            bg: '#f8fafc', // Slate 50
            'bg-dark': '#334155', // Slate 700
          },
        },
        downloaded: {
          DEFAULT: '#f0fdfa', // Teal 50
          dark: '#042f2e', // Teal 950
          hover: {
            DEFAULT: '#ccfbf1', // Teal 100
            dark: '#134e4a', // Teal 900
          },
        },
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'Inter', 'system-ui'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
      boxShadow: {
        'premium': '0 10px 30px -5px rgba(0, 0, 0, 0.1), 0 4px 15px -5px rgba(0, 0, 0, 0.05)',
        'premium-dark': '0 10px 30px -5px rgba(0, 0, 0, 0.4), 0 4px 15px -5px rgba(0, 0, 0, 0.2)',
      },
    },
  },
  plugins: [],
};

