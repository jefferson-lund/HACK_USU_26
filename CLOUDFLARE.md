# Deploying to Cloudflare Pages

This is the Cloudflare-specific path from the deployment options doc: the
Expo web export goes to Cloudflare Pages as static assets, and the OpenAI/
WHOOP proxy that used to be `server/index.js` (Express, a long-running
Node process) is rewritten onto Cloudflare Pages Functions (`functions/`,
Workers runtime) so it can live on the same edge, same origin, as the static
site.

`server/index.js` still works and is still the easiest way to develop
locally (`npm run server` + `npm run web`) — it isn't used in this deploy
path at all. `functions/` is a separate, parallel implementation of the same
small API surface, kept in sync by hand since Express (Node/CommonJS) and
Pages Functions (Workers/ESM) don't share a runtime.

## Why a rewrite was necessary, not just a redeploy

Two things about `server/index.js` don't survive a move to Workers as-is:

1. **Express itself.** Workers don't run Node — no `net`/`http` sockets, no
   Express app. Every route in `server/index.js` has an equivalent file
   under `functions/` written directly against the Fetch API
   (`Request`/`Response`), which Workers support natively.
2. **The in-memory rate limiter.** `server/index.js`'s `rateLimitBuckets`
   `Map` works because it's one long-running Node process with one shared
   memory space. A Worker has no such guarantee — different requests can
   land on different, freshly-cold isolates (possibly in different
   Cloudflare data centers), so an in-memory counter would silently
   under-count and let far more traffic through than intended.
   `functions/_lib/rateLimit.ts` uses Cloudflare's Rate Limiting binding
   instead, which lives in Cloudflare's infrastructure rather than the
   Worker's memory — see **Rate limiting** below.

Everything else — the OpenAI/WHOOP calls, the fallback hypothesis
text, the request/response JSON shapes — is a line-for-line port, not a
redesign, so the client (`lib/llm.ts`, `lib/api/weeklyPlan.ts`,
`lib/whoop.ts`) didn't need to change except for how it finds the API's base
URL (see below).

## One-time setup

```bash
npm install          # picks up wrangler + @cloudflare/workers-types
npx wrangler login    # authorizes the CLI against your Cloudflare account
```

Create the Pages project once (skip if it already exists):

```bash
npx wrangler pages project create wohl
```

## Secrets

Set these once per Cloudflare Pages project — they become `context.env.*` in
every file under `functions/`. Same names `server/.env.example` already
documents for local dev, so the same values work in both places:

```bash
npx wrangler pages secret put OPENAI_API_KEY
npx wrangler pages secret put WHOOP_CLIENT_ID
npx wrangler pages secret put WHOOP_CLIENT_SECRET
npx wrangler pages secret put WHOOP_REDIRECT_URI
```

(Or set them from the dashboard: Workers & Pages → your project → Settings
→ Environment variables.) `WHOOP_REDIRECT_URI` only needs to be set here if
you want a fixed redirect URI — the client already builds one automatically
via `Linking.createURL('whoop-callback')` and sends it with every token
request, so this is a fallback, not a requirement. Whichever redirect URI
ends up in use still needs to be registered in WHOOP's own developer
dashboard (https://developer.whoop.com/) — that's an external step, not
something this rewrite can do for you.

## Rate limiting

`wrangler.toml` declares a `RATE_LIMITER` binding. **It must use
`[[unsafe.bindings]]` with `type = "ratelimit"`, not the newer top-level
`[[ratelimits]]` block.**

This matters more than it looks. Workers rate limiting only reached GA in
September 2025, and the pinned wrangler (3.x) predates it: given
`[[ratelimits]]` it prints `Unexpected fields found in top-level field:
"ratelimits"` followed by `No bindings found` — and then silently carries on.
Because `checkRateLimit()` in `functions/_lib/rateLimit.ts` deliberately fails
open, the result was a *fully uncapped* set of OpenAI-backed endpoints on a
public URL with a live API key, with nothing in the logs saying so.

Verify it rather than trusting the config, because both states start up
successfully:

```bash
npm run cf:build
npx wrangler pages dev dist --port 8788

# Startup should report the binding:
#   - Unsafe Metadata:
#     - ratelimit: RATE_LIMITER [connected to remote resource]

# And the cap should actually bite -- 200, 200, then 429:
for i in 1 2 3; do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST \
    http://127.0.0.1:8788/api/hypothesis \
    -H 'Content-Type: application/json' \
    -d '{"outcome":"sleep better","activities":["walk"]}'
done
```

If you upgrade to wrangler 4.x, switch to `[[ratelimits]]` and run that check
again — do not assume it carried over. The dashboard route (Workers & Pages →
your project → Settings → Functions → Rate limiting bindings) also works; name
the binding `RATE_LIMITER` either way.

The binding only supports fixed 10s or 60s windows, so `wrangler.toml`
approximates the local server's "~30 requests per 15 minutes" as 2 requests/
minute per client. Adjust `simple.limit` / `simple.period` to taste.

Note what a 429 does to the client: `lib/llm.ts` treats any non-OK response as
a reason to fall back to its local template, so a rate-limited visitor sees a
"Template" badge rather than an error. That is a reasonable degradation, but it
does mean hitting the cap looks like a quality drop rather than a limit.

## Build and deploy

```bash
npm run cf:build    # expo export -p web -- writes the static site to dist/
npm run cf:dev       # build, then run the site + functions locally via wrangler
npm run cf:deploy    # build, then deploy dist/ + functions/ to Cloudflare
```

`cf:dev` runs the real Workers runtime locally (via Miniflare), including
`functions/`, so it's a much closer match to production than `npm run web`
+ `npm run server` — use it to sanity-check the Functions before deploying.

## What changes about the client's API base URL

`lib/apiBase.ts` (used by `lib/llm.ts`, `lib/whoop.ts`, and
`lib/api/weeklyPlan.ts`) now defaults to **same-origin relative paths**
(e.g. fetching `/api/hypothesis` rather than
`http://<host>:4000/api/hypothesis`) on web whenever
`EXPO_PUBLIC_API_BASE_URL` isn't set. That's exactly right for Cloudflare
Pages, where the static site and the Functions are served from the same
domain — no configuration needed once deployed.

Local dev is unaffected: `.env.example` already sets
`EXPO_PUBLIC_API_BASE_URL=http://localhost:4000` for `npm run web` +
`npm run server`, which takes priority over the same-origin default.

Native builds (iOS/Android) have no "current origin" to fall back on, so a
native build pointed at a Cloudflare deployment must set
`EXPO_PUBLIC_API_BASE_URL` to the deployed domain explicitly (e.g.
`https://wohl.pages.dev`) — local Expo Go dev keeps working via the existing
dev-server-host guess in `lib/apiBase.ts`.

## What this doesn't fix

This rewrite makes the backend deployable; it doesn't change how the app
stores *data*. `lib/database.web.ts` still keeps each browser tab's activity
log, ratings, and hypothesis in memory only (gone on refresh) — that's a
per-visitor limitation, not a cross-visitor one (each browser tab gets its
own copy, it's not shared server-side the way the deployment options doc
briefly suggested — worth a correction: nothing in `server/index.js` or
`functions/` ever touches that data at all, so deploying the backend here
doesn't change that behavior either way). Real accounts and persistent
per-user data are the separate multi-tenancy plan already drafted
separately.
