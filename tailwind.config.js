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
          DEFAULT: '#1c3017', // Main menu bg
          border: '#374832', // Main menu border
          hover: '#243d1d',
          text: {
            DEFAULT: '#1F321A', // Normal text
            dark: '#E5E7EB', // Dark mode text - lighter gray
          },
        },
        accent: {
          DEFAULT: '#f2761e', // Action buttons/links
          dark: '#60A5FA', // Dark mode accent - nice blue
        },
        surface: {
          DEFAULT: '#FFFBEF', // Main layout bg
          dark: '#111827', // Dark mode bg - deep gray
          alt: {
            DEFAULT: '#EEE8D5', // Table header bg
            dark: '#0c141e', // Dark mode alt bg - slightly lighter
            hover: {
              DEFAULT: '#f5f1e5',
              dark: '#151f32',
            },
            selected: {
              DEFAULT: '#efeadc',
              dark: '#090f18',
              hover: {
                DEFAULT: '#efe8d7',
                dark: '#0c1420',
              },
            },
          },
          hover: {
            DEFAULT: '#f2761e07', // Changed to warm cream color
            dark: '#111827', // Dark mode hover - medium gray
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
          DEFAULT: '#1F321A', // Light mode text
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
          DEFAULT: '#e8f1e8',
          dark: '#0e222b',
          hover: {
            DEFAULT: '#e1f0e1',
            dark: '#101f26',
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
