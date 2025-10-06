import type { Config } from 'tailwindcss';
import { colors, spacing, borderRadius } from './src/lib/design-system';

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


