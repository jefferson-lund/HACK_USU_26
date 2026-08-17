import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Resolves the base URL for the backend API (the OpenAI/Gemini/WHOOP proxy).
 *
 * Priority:
 * 1. `EXPO_PUBLIC_API_BASE_URL` override -- used for local dev (points at the
 *    local Express server, e.g. http://localhost:4000, see .env.example) or
 *    to point a native build at a specific deployed host.
 * 2. Web, no override: Cloudflare Pages Functions are served from the same
 *    origin as the static site they sit alongside, so an empty base --
 *    meaning "fetch relative paths like /api/hypothesis" -- resolves
 *    correctly with zero configuration once deployed. This only kicks in
 *    when EXPO_PUBLIC_API_BASE_URL isn't set, which local dev always sets.
 * 3. Native, no override: fall back to the Expo dev server's host on :4000,
 *    for local Expo Go / dev-build convenience only -- there's no "current
 *    origin" for a native app, so a deployed native build must set
 *    EXPO_PUBLIC_API_BASE_URL explicitly. Returns null when even that guess
 *    isn't available, so callers know there's truly nowhere to send a
 *    request rather than trying a nonsense URL.
 */
export function getApiBase(): string | null {
  const fromEnv =
    typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, '');
  }

  if (Platform.OS === 'web') {
    return '';
  }

  const hostUri =
    // SDK 54/55: hostUri usually lives here during development
    (Constants.expoConfig as any)?.hostUri ||
    // Fallback for older/newer configs
    (Constants as any).manifest2?.extra?.expoClient?.hostUri ||
    (Constants as any).manifest?.hostUri;

  if (hostUri && typeof hostUri === 'string') {
    // Examples:
    // - 192.168.1.10:8081
    // - exp://192.168.1.10:8081
    // - 192.168.1.10:8081?something
    const withoutScheme = hostUri.replace(/^https?:\/\//, '').replace(/^exp:\/\//, '');
    const [hostAndPort] = withoutScheme.split(/[/?]/);
    const [host] = hostAndPort.split(':');
    if (host) {
      return `http://${host}:4000`;
    }
  }

  return null;
}
