import { useColorScheme as useColorSchemeCore } from 'react-native';

/**
 * Always resolves to a concrete scheme.
 *
 * React Native's hook returns `null` when the OS preference is unavailable,
 * but this previously only special-cased the string 'unspecified' -- which
 * ColorSchemeName never actually contains. So a null leaked straight through
 * to `Colors[theme][colorName]` in components/Themed.tsx, where indexing with
 * null yields undefined and reading a property off it throws. Every themed
 * Text and View was one unset OS preference away from a crash.
 */
export function useColorScheme(): 'light' | 'dark' {
  return useColorSchemeCore() ?? 'light';
}
