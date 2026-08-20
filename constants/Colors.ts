const tintColorLight = '#2f95dc';
const tintColorDark = '#fff';

export default {
  light: {
    text: '#000',
    background: '#fff',
    tint: tintColorLight,
    tabIconDefault: '#ccc',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#fff',
    background: '#000',
    tint: tintColorDark,
    tabIconDefault: '#ccc',
    tabIconSelected: tintColorDark,
  },
};

// Brand palette used by the Setup and Track screens (app/(v2)/index.tsx,
// app/(v2)/track.tsx, and components/track/*). This is a separate,
// app-specific palette from the generic light/dark theme above — those
// screens don't participate in the dark/light mode system yet.
export const Brand = {
  // Core brand colors
  orange: '#f55e61',
  blue: '#4a90e2',

  // Text / ink scale
  ink: '#1a1a1a',
  inkSoft: '#666666',
  inkFaint: '#999999',
  white: '#ffffff',

  // Setup screen inputs & chips
  inputBackground: '#fafafa',
  inputBorder: '#e8e8e8',
  chipBackground: '#f8f8f8',
  chipBorder: '#e0e0e0',
  blueTint: '#f7faff',

  // Track screen accents
  shadow: '#000000',
  accentBlue: '#2563eb',

  // Success / plan (green) scale
  success: '#059669',
  successDark: '#065f46',
  successText: '#047857',
  successLight: '#10b981',

  // Danger (red) scale
  danger: '#dc2626',
  dangerLight: '#ef4444',

  // Slate scale (tables)
  slateDark: '#1e293b',
  slateMed: '#334155',
  slateSoft: '#475569',
  slateFaint: '#64748b',
  slateFainter: '#94a3b8',
  slateBg: '#f1f5f9',
};
