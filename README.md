# wohl

> A wellness self-experimentation tool for learning which daily activities help.

wohl lets someone choose an outcome, track candidate activities and a daily
1–10 rating, then compare those activities with their results. It began as a
Hack USU 2026 project and now ships a redesigned product alongside the original
hackathon interface.

## Product flow

1. Define one outcome to improve.
2. Add activities that might influence it.
3. Review an AI-generated or local-template hypothesis.
4. Complete a short daily check-in.
5. Run same-day or next-day analysis when ready.
6. Review plain-language signals, model fit, and an optional weekly plan.

The hypothesis endpoint degrades to a local template, so setup and saving still
work when the development server is stopped.

## Two interfaces, one dataset

Both versions ship together:

| Interface | Setup | Track |
| --- | --- | --- |
| Modern v2 | `/` | `/track` |
| Frozen original | `/legacy` | `/legacy/track` |

The version switch uses Expo Router navigation rather than a hard page load.
This is required because web storage is currently in memory; reloading the page
clears the browser tab's data. Both interfaces import the same database module,
so data entered in one is immediately visible in the other.

The modern interface is intentionally light-only. Its semantic design tokens
live in `constants/theme.ts`, reusable controls in `components/ui/`, and
product-specific visualizations in `components/v2/`. The original routes and
their shared display components remain frozen as the before-picture.

## Stack

- Expo SDK 54, React Native 0.81.5, React 19, TypeScript 5.9
- Expo Router 6 with typed routes
- React Native Web with Metro static export
- `react-native-svg` for charts
- SQLite on native; in-memory storage on web
- Express for the local API and Cloudflare Pages Functions in production
- OpenAI GPT-4o-mini with a deterministic template fallback

## Route and component structure

```text
app/
├── (v2)/                 # / and /track — redesigned product
├── legacy/               # /legacy and /legacy/track — frozen original
├── _layout.tsx           # preference restore and splash gate
└── +html.tsx             # pre-hydration version preference gate

components/
├── ui/                   # Text, Card, Button, Field, Section, Pill, DataGrid…
├── v2/                   # Wordmark, insights, charts, weekly plan
└── track/                # frozen original display components

constants/
├── Colors.ts             # original Brand palette
└── theme.ts              # semantic v2 tokens

lib/
├── analysis.ts           # correlation/regression analysis
├── database.web.ts       # browser-tab in-memory store
├── database.native.ts    # SQLite store
├── llm.ts                # hypothesis client and fallback
├── api/weeklyPlan.ts     # weekly-plan client
└── whoop.ts              # optional WHOOP integration

server/                   # local Express API only
functions/                # production Cloudflare Pages Functions
```

## Local development

The pinned Node binary in the original development environment is v24.19.0.
Any current Node release supported by Expo SDK 54 should work.

```bash
npm install

# Web app
npm run web

# Optional local API in a second terminal
npm run server
```

Without a local `.env`, hypothesis generation uses the template fallback. WHOOP
controls remain hidden unless `EXPO_PUBLIC_WHOOP_CLIENT_ID` is configured.

## Verification

There is no test runner or linter. These are the automated gates:

```bash
npm run typecheck
npm run verify
```

`verify` exercises regression alignment, lag direction, date handling, sample
data quality, and the real web storage implementation.

Manual version checks:

1. Load `/`, `/track`, `/legacy`, and `/legacy/track`.
2. Switch from `/track` to Original and confirm `/legacy/track` opens.
3. Enter setup data in one version and confirm it appears in the other.
4. Set the preference to Original and reload `/`; it should open `/legacy`.
5. Load `/track` explicitly while Original is preferred; it must stay on `/track`.

## Deployment

Production is a static Expo export on Cloudflare Pages:

```bash
npm run cf:build
npm run cf:dev
```

The Cloudflare project auto-deploys from `main`. See
[CLOUDFLARE.md](./CLOUDFLARE.md) for the Functions runtime, secrets, rate
limiting, API base URL behavior, and deployment commands.

## Current limitations

- Web data is per-tab and disappears on hard refresh.
- Native storage changes require device testing; `expo-sqlite` is currently
  newer than the version expected by Expo SDK 54.
- WHOOP is unconfigured in current builds, and its callback route remains future
  work.

Built by Jefferson, Cooper, and Cader for Hack USU 2026.
