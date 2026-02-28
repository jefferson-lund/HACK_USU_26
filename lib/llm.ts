import { Platform } from 'react-native';
import Constants from 'expo-constants';

function getBaseUrl(): string | null {
  // 1. Explicit override via env (works for web and native)
  const fromEnv =
    typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  // 2. Web: always try backend on port 4000 when running on localhost
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const { hostname } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:4000';
    }
    return `http://${hostname}:4000`;
  }

  // 3. Native (Expo Go / dev build): use Expo hostUri and swap to port 4000
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

export type HypothesisResult = { hypothesis: string; usedFallback: boolean };

export async function generateHypothesis(
  outcome: string,
  activities: string[],
): Promise<HypothesisResult> {
  const trimmedOutcome = outcome.trim();
  const filteredActivities = activities.map((a) => a.trim()).filter(Boolean);

  if (!trimmedOutcome || filteredActivities.length === 0) {
    throw new Error('Outcome and at least one activity are required to generate a hypothesis.');
  }

  const fallbackText = () =>
    `My working hypothesis is that regularly ${filteredActivities.join(
      ', ',
    )} will help me ${trimmedOutcome}.`;

  const baseUrl = getBaseUrl();
  console.log('[LLM] Base URL:', baseUrl ?? '(none)');

  if (!baseUrl) {
    console.warn('[LLM] No backend base URL. Start the server with: npm run server');
    return { hypothesis: fallbackText(), usedFallback: true };
  }

  try {
    const url = `${baseUrl}/hypothesis`;
    console.log('[LLM] Calling backend:', url);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outcome: trimmedOutcome,
        activities: filteredActivities,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.warn('[LLM] Backend error', response.status, body);
      return { hypothesis: fallbackText(), usedFallback: true };
    }

    const data = (await response.json()) as {
      hypothesis?: string;
      usedFallback?: boolean;
    };

    const content = data.hypothesis?.trim();
    if (!content) {
      console.warn('[LLM] No hypothesis in response');
      return { hypothesis: fallbackText(), usedFallback: true };
    }

    console.log('[LLM] OK, usedFallback:', data.usedFallback);
    return { hypothesis: content, usedFallback: data.usedFallback === true };
  } catch (error) {
    console.warn('[LLM] Request failed (is the server running?).', error);
    return { hypothesis: fallbackText(), usedFallback: true };
  }
}