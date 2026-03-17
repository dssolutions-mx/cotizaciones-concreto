import type { Config } from 'tailwindcss';

const colors = {
  systemBlue: '#007AFF',
  systemGreen: '#34C759',
  systemOrange: '#FF9500',
  systemRed: '#FF3B30',
  systemGray: {
    1: '#8E8E93',
    2: '#AEAEB2',
    3: '#C7C7CC',
    4: '#D1D1D6',
    5: '#E5E5EA',
    6: '#F2F2F7',
  },
  label: {
    primary: '#000000',
    secondary: 'rgba(60, 60, 67, 0.6)',
  },
  dark: {
    systemGray: {
      1: '#8E8E93',
      2: '#636366',
      3: '#48484A',
      4: '#3A3A3C',
      5: '#2C2C2E',
      6: '#1C1C1E',
    },
  },
} as const;

const spacing = {
  0: '0px',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
  20: '80px',
  24: '96px',
} as const;

const borderRadius = {
  none: '0px',
  sm: '8px',
  DEFAULT: '12px',
  lg: '16px',
  xl: '20px',
  '2xl': '24px',
  '3xl': '28px',
  full: '9999px',
} as const;

const config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ...colors,
        'system-gray': colors.systemGray,
        'dark-system-gray': colors.dark.systemGray,
        'label-primary': colors.label.primary,
        'label-secondary': colors.label.secondary,
      },
      spacing: {
        ...spacing,
      },
      borderRadius: {
        ...borderRadius,
      },
      fontFamily: {
        'sf-pro': ['SF Pro Text', 'SF Pro Display', '-apple-system', 'BlinkMacSystemFont', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;

export default config;


