// The bindings/environment variables available to every Pages Function.
// Secrets are set per-project via `wrangler pages secret put <NAME>` or the
// Cloudflare dashboard (Workers & Pages -> your project -> Settings ->
// Environment variables) -- see CLOUDFLARE.md.
export interface Env {
  OPENAI_API_KEY?: string;
  EXPO_PUBLIC_OPENAI_API_KEY?: string;
  WHOOP_CLIENT_ID?: string;
  EXPO_PUBLIC_WHOOP_CLIENT_ID?: string;
  WHOOP_CLIENT_SECRET?: string;
  EXPO_PUBLIC_WHOOP_CLIENT_SECRET?: string;
  WHOOP_REDIRECT_URI?: string;
  EXPO_PUBLIC_WHOOP_REDIRECT_URI?: string;

  // Cloudflare's native Rate Limiting binding (see wrangler.toml /
  // CLOUDFLARE.md). Optional and typed loosely on purpose -- functions/_lib/
  // rateLimit.ts fails open if this isn't configured, rather than making
  // every route depend on it being set up correctly.
  RATE_LIMITER?: {
    limit: (options: { key: string }) => Promise<{ success: boolean }>;
  };
}

// Prefer a server-side secret name, but fall back to the same
// EXPO_PUBLIC_-prefixed names the Express server (server/index.js) and
// .env.example use, so the same .env can seed either backend.
export function getOpenAiKey(env: Env): string | undefined {
  return env.OPENAI_API_KEY || env.EXPO_PUBLIC_OPENAI_API_KEY;
}

export function getWhoopClientId(env: Env): string | undefined {
  return env.WHOOP_CLIENT_ID || env.EXPO_PUBLIC_WHOOP_CLIENT_ID;
}

export function getWhoopClientSecret(env: Env): string | undefined {
  return env.WHOOP_CLIENT_SECRET || env.EXPO_PUBLIC_WHOOP_CLIENT_SECRET;
}

export function getWhoopRedirectUri(env: Env): string | undefined {
  return env.WHOOP_REDIRECT_URI || env.EXPO_PUBLIC_WHOOP_REDIRECT_URI;
}
