export const typography = {
  largeTitle: {
    fontSize: '34px',
    fontWeight: 700,
    lineHeight: '41px',
    letterSpacing: '0.37px',
    fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif"
  },
  title1: {
    fontSize: '28px',
    fontWeight: 700,
    lineHeight: '34px',
    letterSpacing: '0.36px',
    fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif"
  },
  title2: {
    fontSize: '22px',
    fontWeight: 700,
    lineHeight: '28px',
    letterSpacing: '0.35px',
    fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif"
  },
  title3: {
    fontSize: '20px',
    fontWeight: 600,
    lineHeight: '25px',
    letterSpacing: '0.38px',
    fontFamily: "'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif"
  },
  body: {
    fontSize: '17px',
    fontWeight: 400,
    lineHeight: '22px',
    letterSpacing: '-0.41px',
    fontFamily: "'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif"
  },
  callout: {
    fontSize: '16px',
    fontWeight: 400,
    lineHeight: '21px',
    letterSpacing: '-0.32px',
    fontFamily: "'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif"
  },
  footnote: {
    fontSize: '13px',
    fontWeight: 400,
    lineHeight: '18px',
    letterSpacing: '-0.08px',
    fontFamily: "'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif"
  },
  caption: {
    fontSize: '12px',
    fontWeight: 400,
    lineHeight: '16px',
    letterSpacing: '0px',
    fontFamily: "'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif"
  }
} as const;

export type Typography = typeof typography;


