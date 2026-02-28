import { Platform } from 'react-native';
import Constants from 'expo-constants';

function getBaseUrl(): string | null {
  // 1. Explicit override via env (works for web and native)
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (fromEnv) {
    return fromEnv;
  }

  // 2. Web: derive from current origin (assumes backend on same host, port 4000)
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:4000`;
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

export async function generateHypothesis(outcome: string, activities: string[]): Promise<string> {
  const trimmedOutcome = outcome.trim();
  const filteredActivities = activities.map((a) => a.trim()).filter(Boolean);

  if (!trimmedOutcome || filteredActivities.length === 0) {
    throw new Error('Outcome and at least one activity are required to generate a hypothesis.');
  }

  console.log('[LLM] generateHypothesis', {
    outcome: trimmedOutcome,
    activities: filteredActivities,
  });

  const fallback = () =>
    `My working hypothesis is that regularly ${filteredActivities.join(
      ', ',
    )} will help me ${trimmedOutcome}.`;

  try {
    console.log('[LLM] Calling backend /api/hypothesis…');

    const baseUrl = getBaseUrl();

    if (!baseUrl) {
      console.warn('[LLM] No backend base URL resolved. Falling back to local hypothesis template.');
      return fallback();
    }

    const response = await fetch(`${baseUrl}/api/hypothesis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        outcome: trimmedOutcome,
        activities: filteredActivities,
      }),
    });

    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      hypothesis?: string;
      usedFallback?: boolean;
    };

    const content = data.hypothesis?.trim();
    if (!content) {
      throw new Error('No hypothesis returned from backend.');
    }

    console.log('[LLM] Hypothesis received from backend.', {
      usedFallback: data.usedFallback,
    });

    return content;
  } catch (error) {
    console.warn('Failed to generate hypothesis via OpenAI, using fallback.', error);
    return fallback();
  }
}