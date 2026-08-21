# wohl project context

## Product

wohl is a wellness self-experimentation app. A user defines an outcome and
candidate daily activities, records check-ins, and runs correlation or
regression analysis to learn what may help.

## Stack

- Expo SDK 54 / React Native 0.81.5 / React 19 / TypeScript 5.9
- Expo Router 6 with typed, file-based routes
- React Native Web; static Metro export for Cloudflare Pages
- `react-native-svg` for charts
- SQLite on native and in-memory storage on web
- Express for local API development; Cloudflare Pages Functions in production

Web is intentionally light-only. Do not add a dark mode to the redesigned
screens.

## Versioned route architecture

The app ships two interfaces:

```text
app/
├── (v2)/                 # parenthesized, so it owns / and /track
│   ├── _layout.tsx
│   ├── index.tsx
│   └── track.tsx
└── legacy/               # real URL segment: /legacy and /legacy/track
    ├── _layout.tsx
    ├── index.tsx
    └── track.tsx
```

Do not parenthesize `legacy`; two sibling route groups would collide at `/`.
The original interface is frozen in `app/legacy/`. Modern components belong in
`components/v2/` and reusable controls belong in `components/ui/`.

`VersionSwitch` must use `router.replace`, never `window.location`. Web storage
is in memory, so a hard navigation destroys the current setup and check-ins.
Both versions intentionally share one database module instance.

The pre-hydration preference gate in `app/+html.tsx` must remain restricted to
the exact `/` path. Explicit versioned URLs always win over the saved preference.

## Modern design system

`constants/Colors.ts` owns the original `Brand` palette and must remain stable
for the legacy interface. `constants/theme.ts` maps that palette to semantic v2
roles:

- coral is identity and edit affordance, never a negative signal
- light blue is for large accessible fills and tints
- strong blue is for text, icons, selected controls, and positive chart ink
- red is negative chart ink
- slate is the diverging midpoint

Use the six type variants from `components/ui/Text` rather than creating ad-hoc
font sizes. New v2 surfaces should use the primitives in `components/ui/`.
Do not import `components/Themed.tsx` in modern screens.

## Modern Setup flow

`app/(v2)/index.tsx` is one mounted screen with three steps:

1. Outcome
2. Activities
3. Review and save

Keep the 600 ms hypothesis debounce and generation counter. Save remains a
sibling of the hypothesis card and depends only on a non-empty outcome plus at
least one activity. Hypothesis failure must never block saving.

Activity deduplication is whitespace-normalized and case-insensitive. Commas
split one entry into multiple chips.

## Modern Track flow

`app/(v2)/track.tsx` is dashboard-first:

1. Header and local date
2. Always-visible daily check-in
3. Cheap headline stats loaded on focus
4. Always-visible analysis entry/results
5. Weekly plan
6. Collapsed raw data
7. Collapsed developer tools

The cheap dashboard pass uses `getFullDataset()`. Regression remains explicit
on first run because `ml-regression` executes synchronously on the JS thread.
Yield one frame before calling `getRegressionAnalysis` so busy UI can paint.

Changing Same-day/Next-day reruns existing results immediately. Preserve prior
content at reduced opacity while rerunning. After check-in writes, mark existing
results stale and ask the user to refresh.

Never render `generateInsightSummary()` in v2. Build copy directly from
`RegressionResult.impacts`, and branch on `method`:

- Pearson is bounded correlation (`r`) and must not claim outcome points.
- Multiple regression coefficients are outcome-point estimates.

Scatter point dates must come from `RegressionResult.dates`, especially under
next-day lag.

No `alert()` calls are allowed in v2. Use inline `Callout` state and roll back
failed optimistic writes.

## Data contracts

Do not change public signatures in `lib/`. Important behavior:

- `getSetup()` returns null unless both an outcome and activities exist.
- `getFullDataset()` returns date-descending rows.
- `clearOutcomeRating(date)` removes only that day's rating.
- `getRegressionAnalysis()` sorts ascending internally; do not remove the sort.
- Lag only pairs adjacent calendar dates.
- `dateKey()` produces local `YYYY-MM-DD` keys; never use UTC ISO dates for
  calendar check-ins.
- Missing WHOOP values stay missing; do not invent zeroes.

The web and native database implementations must continue to implement the same
contract.

## API and deployment

Client API base resolution is centralized in `lib/apiBase.ts`. Web defaults to
same-origin; native uses an Expo host guess unless explicitly configured.

`server/index.js` and `functions/` are parallel implementations that must be
kept in sync by hand. Cloudflare rate limiting requires
`[[unsafe.bindings]] type = "ratelimit"` with the pinned Wrangler 3 release.

## Verification

Run after each meaningful change:

```bash
npm run typecheck
npm run verify
```

Manual gates:

- `/`, `/track`, `/legacy`, and `/legacy/track` render
- the version switch preserves the current tab and in-memory data
- `app/legacy/` has no redesign diff
- sample data can produce insights, impact bars, scatter, and tables without
  opening an analytics accordion
- changing timing reruns analysis and keeps next-day dates aligned
- the five-tap wordmark easter egg still creates three dinosaurs for 3500 ms
