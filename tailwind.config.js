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
          DEFAULT: '#F0EEE7', // Main layout bg
          dark: '#111827', // Dark mode bg - deep gray
          alt: {
            DEFAULT: '#EEE8D5', // Table header bg
            dark: '#0c141e', // Dark mode alt bg - slightly lighter
            hover: {
              DEFAULT: '#f0ece1',
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
        label: {
          // GREEN
          success: {
            text: '#5f7458',
            'text-dark': '#34D399', // Dark mode success - emerald
            bg: '#dbecd6',
            'bg-dark': '#064E3B', // Dark mode success bg
          },
          // RED
          danger: {
            text: '#7f4549',
            'text-dark': '#F87171', // Dark mode danger - red
            bg: '#f1dbe0',
            'bg-dark': '#7F1D1D', // Dark mode danger bg - deep red
          },
          // YELLOW
          warning: {
            text: '#6f5f44',
            'text-dark': '#F59E0B', // Dark mode yellow - amber
            bg: '#eee6c8',
            'bg-dark': '#78350F', // Dark mode warning bg - brown
          },
          // BLUE
          active: {
            text: '#4f5f7f',
            'text-dark': '#5a94f3', // Dark mode blue
            bg: '#dbe0f1',
            'bg-dark': '#1E3A8A', // Dark mode active bg - deep blue
          },
          // GRAY
          default: {
            text: '#5f5f5f',
            'text-dark': '#95979d', // Dark mode gray
            bg: '#dfdfdf',
            'bg-dark': '#374151', // Dark mode default bg - slightly lighter
          },
        },
        downloaded: {
          DEFAULT: '#dfe6da',
          dark: '#0e222b',
          hover: {
            DEFAULT: '#d8e5cf',
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
