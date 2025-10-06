export const colors = {
  // Primary Actions
  systemBlue: '#007AFF',
  systemGreen: '#34C759',
  systemOrange: '#FF9500',
  systemRed: '#FF3B30',

  // Neutrals (Light Mode)
  systemGray: {
    1: '#8E8E93',
    2: '#AEAEB2',
    3: '#C7C7CC',
    4: '#D1D1D6',
    5: '#E5E5EA',
    6: '#F2F2F7'
  },

  // Text Colors (Light Mode)
  label: {
    primary: '#000000',
    secondary: 'rgba(60, 60, 67, 0.6)',
    tertiary: 'rgba(60, 60, 67, 0.3)',
    quaternary: 'rgba(60, 60, 67, 0.18)'
  },

  // Backgrounds (Light Mode)
  background: {
    primary: '#FFFFFF',
    secondary: '#F2F2F7',
    tertiary: '#FFFFFF',
    grouped: {
      primary: '#F2F2F7',
      secondary: '#FFFFFF',
      tertiary: '#F2F2F7'
    }
  },

  // Dark Mode
  dark: {
    label: {
      primary: '#FFFFFF',
      secondary: 'rgba(235, 235, 245, 0.6)',
      tertiary: 'rgba(235, 235, 245, 0.3)',
      quaternary: 'rgba(235, 235, 245, 0.18)'
    },
    background: {
      primary: '#000000',
      secondary: '#1C1C1E',
      tertiary: '#2C2C2E',
      grouped: {
        primary: '#000000',
        secondary: '#1C1C1E',
        tertiary: '#2C2C2E'
      }
    },
    systemGray: {
      1: '#8E8E93',
      2: '#636366',
      3: '#48484A',
      4: '#3A3A3C',
      5: '#2C2C2E',
      6: '#1C1C1E'
    }
  }
} as const;

export type SystemColors = typeof colors;


