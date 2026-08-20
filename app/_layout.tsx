import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, router, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { hrefFor } from '@/lib/siteVersion';
import { getVersion, hydrateVersionPreference } from '@/lib/versionPreference';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

// Prevent the splash screen from auto-hiding before the version preference has
// been read, so the async native read is never visible.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return <RootLayoutNav />;
}

/**
 * Sends a returning visitor back to the version they last chose.
 *
 * On web this is usually a no-op: the inline script in app/+html.tsx has
 * already redirected before the bundle was even requested. This covers native,
 * and web when storage is blocked and that script bailed out.
 */
function useRestoreVersionPreference() {
  const pathname = usePathname();
  const settled = useRef(false);

  useEffect(() => {
    if (settled.current) return;
    settled.current = true;

    let alive = true;
    void (async () => {
      try {
        await hydrateVersionPreference();
        const stored = await getVersion();
        // Only "/" is ambiguous. An explicit versioned URL always wins, so a
        // shared link shows what it says regardless of stored preference.
        if (alive && stored === 'legacy' && pathname === '/') {
          router.replace(hrefFor('legacy'));
        }
      } finally {
        SplashScreen.hideAsync().catch(() => {});
      }
    })();

    return () => {
      alive = false;
    };
  }, [pathname]);
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  useRestoreVersionPreference();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false, animation: 'none' }}>
        <Stack.Screen name="(v2)" />
        <Stack.Screen name="legacy" />
      </Stack>
    </ThemeProvider>
  );
}
