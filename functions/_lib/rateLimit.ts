import type { Env } from './env';

// The Express server (server/index.js) used an in-memory Map for its rate
// limiter, which works fine on a single long-running Node process but breaks
// on Workers/Pages Functions: there's no reliable memory shared across
// requests (each request can hit a different, freshly-cold isolate, possibly
// in a different Cloudflare data center), so an in-memory counter would
// under-count and let far more than the intended request rate through.
//
// This uses Cloudflare's native Rate Limiting binding instead, which is
// backed by Cloudflare's own infrastructure rather than this Function's
// memory. See CLOUDFLARE.md for how to add the RATE_LIMITER binding (either
// via wrangler.toml's [[ratelimits]] block or the dashboard) -- it's a
// newer Cloudflare feature, so double check the exact config shape against
// Cloudflare's current docs if wrangler rejects the wrangler.toml block.
//
// If the binding isn't set up (yet), this fails open -- an unlimited demo
// is better than a demo that's completely down because of a missing binding.
export async function checkRateLimit(env: Env, key: string): Promise<boolean> {
  if (!env.RATE_LIMITER) {
    return true;
  }
  try {
    const { success } = await env.RATE_LIMITER.limit({ key });
    return success;
  } catch (err) {
    console.error('[functions] Rate limiter error, failing open:', err);
    return true;
  }
}

// Cloudflare sets this at the edge on every request; there's no equivalent
// of Express's req.ip to fall back to on Workers.
export function clientKey(request: Request): string {
  return request.headers.get('CF-Connecting-IP') || 'unknown';
}
