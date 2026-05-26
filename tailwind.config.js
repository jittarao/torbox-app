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
          DEFAULT: '#18181b',
          border: '#e4e4e7',
          hover: '#27272a',
          text: {
            DEFAULT: '#18181b',
            dark: '#e4e4e7',
          },
        },
        accent: {
          DEFAULT: '#f2761e', // Action buttons/links
          dark: '#f59e0b', // Dark mode accent - amber (matches landing)
        },
        surface: {
          DEFAULT: '#fafafa',
          dark: '#0f0f10',
          alt: {
            DEFAULT: '#f4f4f5',
            dark: '#161618',
            hover: {
              DEFAULT: '#e4e4e7',
              dark: '#1c1c1f',
            },
            selected: {
              DEFAULT: '#fef3eb',
              dark: '#252019',
              hover: {
                DEFAULT: '#fde6d4',
                dark: '#2e2822',
              },
            },
          },
          hover: {
            DEFAULT: '#f2761e12',
            dark: '#1a1a1d',
          },
        },
        progress: {
          track: {
            DEFAULT: '#e4e4e7',
            dark: '#2a2a2e',
          },
        },
        border: {
          DEFAULT: '#cecece',
          dark: '#3c3c3c', // Dark mode border - medium gray
        },
        muted: {
          DEFAULT: '#6b7280', // Light mode muted text - gray-500
          dark: '#9ca3af', // Dark mode muted text - gray-400
        },
        text: {
          DEFAULT: '#18181b', // Light mode text (aligned with primary)
          dark: '#E5E7EB', // Dark mode text
        },
        label: {
          // GREEN
          success: {
            text: '#387d20',
            'text-dark': '#34D399', // Dark mode success - emerald
            bg: '#e2f1de',
            'bg-dark': '#064E3B', // Dark mode success bg
          },
          // RED
          danger: {
            text: '#c1444c',
            'text-dark': '#F87171', // Dark mode danger - red
            bg: '#f7dfe2',
            'bg-dark': '#7F1D1D', // Dark mode danger bg - deep red
          },
          // YELLOW
          warning: {
            text: '#d9a31b',
            'text-dark': '#F59E0B', // Dark mode yellow - amber
            bg: '#f7f0df',
            'bg-dark': '#78350F', // Dark mode warning bg - brown
          },
          // BLUE
          active: {
            text: '#3871e3',
            'text-dark': '#5a94f3', // Dark mode blue
            bg: '#dee5f9',
            'bg-dark': '#1E3A8A', // Dark mode active bg - deep blue
          },
          // GRAY
          default: {
            text: '#828282',
            'text-dark': '#95979d', // Dark mode gray
            bg: '#e7e7e7',
            'bg-dark': '#374151', // Dark mode default bg - slightly lighter
          },
        },
        downloaded: {
          DEFAULT: '#f1f3f6',
          dark: '#171a1e',
          hover: {
            DEFAULT: '#e8ebf0',
            dark: '#1c2026',
          },
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui'],
      },
      borderColor: {
        DEFAULT: '#cecece',
        dark: '#3c3c3c',
      },
    },
  },
  plugins: [],
};
