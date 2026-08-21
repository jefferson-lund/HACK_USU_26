import type { TextStyle, ViewStyle } from 'react-native';

import { Brand } from './Colors';

export const color = {
  background: Brand.white,
  surface: Brand.white,
  surfaceMuted: Brand.inputBackground,
  surfaceSubtle: Brand.chipBackground,
  surfaceInfo: Brand.blueTint,
  border: Brand.inputBorder,
  borderStrong: Brand.chipBorder,
  text: Brand.ink,
  textSoft: Brand.inkSoft,
  textDecoration: Brand.inkFaint,
  textOnColor: Brand.white,
  primary: Brand.blue,
  primaryStrong: Brand.accentBlue,
  brand: Brand.orange,
  danger: Brand.danger,
  dangerStrong: Brand.dangerLight,
  success: Brand.successDark,
  successText: Brand.successText,
  slateDark: Brand.slateDark,
  slateMed: Brand.slateMed,
  slateSoft: Brand.slateSoft,
  slateFaint: Brand.slateFaint,
  slateDecoration: Brand.slateFainter,
  slateSurface: Brand.slateBg,
  chartPositive: Brand.accentBlue,
  chartNegative: Brand.danger,
  chartNeutral: Brand.slateFaint,
} as const;

export const alpha = {
  ink02: 'rgba(0, 0, 0, 0.02)',
  ink10: 'rgba(0, 0, 0, 0.1)',
  neutral20: 'rgba(150, 150, 150, 0.2)',
  neutral50: 'rgba(150, 150, 150, 0.5)',
  primary10: 'rgba(37, 99, 235, 0.1)',
  primary20: 'rgba(37, 99, 235, 0.2)',
  primary30: 'rgba(37, 99, 235, 0.3)',
  danger15: 'rgba(239, 68, 68, 0.15)',
  danger30: 'rgba(239, 68, 68, 0.3)',
  divider80: 'rgba(226, 232, 240, 0.8)',
  infoSurface50: 'rgba(239, 246, 255, 0.5)',
  success20: 'rgba(16, 185, 129, 0.2)',
  success30: 'rgba(16, 185, 129, 0.3)',
  success40: 'rgba(16, 185, 129, 0.4)',
  successSurface60: 'rgba(236, 253, 245, 0.6)',
  white70: 'rgba(255, 255, 255, 0.7)',
} as const;

export const type = {
  display: {
    fontSize: 40,
    lineHeight: 44,
    fontWeight: '700',
    letterSpacing: -1,
  },
  h1: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '600',
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
  },
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
} satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;

export const weight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} satisfies Record<string, TextStyle['fontWeight']>;

export const space = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const elevation = {
  low: {
    shadowColor: Brand.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  medium: {
    shadowColor: Brand.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  high: {
    shadowColor: Brand.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 6,
  },
} satisfies Record<string, ViewStyle>;

export const layout = {
  maxWidth: 680,
  gutter: 24,
  sectionGap: 32,
  tabBarHeight: 80,
  minTouch: 44,
  keyboardVerticalOffset: 80,
} as const;
