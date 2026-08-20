# HANDOFF — wohl (HACK_USU_26)

Machine-oriented state dump + next-task spec. Written for an AI agent picking this
repo up cold. Terse on purpose. Read all of §1–§7 before editing anything; §8 is
the task.

---

## 1. IDENTITY / STACK

- App name: **wohl**. A wellness self-experimentation tool: user declares an
  outcome + candidate daily activities, logs check-ins, and the app regresses
  activities against outcome ratings to suggest what helps.
- Origin: 24-hour hackathon project, since audited and hardened.
- Stack: Expo SDK 54 / React Native 0.81.5 / React 19 / TypeScript 5.9 /
  expo-router 6 (file-based) / react-native-web.
- `app.json`: `scheme: "hackusu26"`, `web.output: "static"`, `web.bundler: "metro"`,
  `experiments.typedRoutes: true`.
- Charts: **react-native-svg only**. No chart library. `react-native-chart-kit`,
  `expo-symbols`, `expo-status-bar` were removed (all had zero importers).
- Web is **permanently light mode**: `components/useColorScheme.web.ts` hardcodes
  `'light'`. Do not build a dark mode.

## 2. DEPLOYMENT

- Cloudflare Pages, custom domain `wohl.aj-data.com`, auto-deploys on push to
  `origin/main` via GitHub webhook.
- Static site: `npm run cf:build` → `expo export -p web` → `dist/`.
- Backend: `functions/` = Cloudflare Pages Functions (Workers runtime). Routes:
  `/api/hypothesis`, `/hypothesis` (back-compat), `/api/weekly-plan`,
  `/api/whoop/token`, `/api/health`.
- `server/index.js` (Express) is the **local-dev-only** equivalent. Kept in sync by
  hand; Express and Workers share no runtime. See `CLOUDFLARE.md`.
- Secrets set on Cloudflare: `OPENAI_API_KEY` only. WHOOP vars are **unset**.
- No local `.env` exists (only `.env.example`). Consequence: locally
  `generateHypothesis` always returns its template fallback and the UI shows the
  "Template" badge, not "AI Generated". This is expected, not a bug.

## 3. ROUTE TREE / VERSION SPLIT (the defining structural feature)

The site ships **two versions simultaneously**:

```
app/
  _layout.tsx        root Stack, screenOptions {headerShown:false, animation:'none'}
                     + useRestoreVersionPreference() + SplashScreen gate
  +html.tsx          web HTML shell; contains the PRE-HYDRATION version gate <script>
  +not-found.tsx     404; href="/" (still valid, v2 owns /)
  (v2)/              parenthesized => contributes NO url segment => owns / and /track
    _layout.tsx      Tabs + <VersionSwitch/>
    index.tsx        /        Setup screen
    track.tsx        /track   Track screen
  legacy/            NOT parenthesized => real segment
    _layout.tsx
    index.tsx        /legacy
    track.tsx        /legacy/track
```

URLs: `/`, `/track`, `/legacy`, `/legacy/track`.

**Why only one group is parenthesized:** two sibling parenthesized groups would both
resolve to `/`. That is a genuine expo-router route collision, not a style choice.
Do not convert `legacy/` to `(legacy)/`.

Build also emits `dist/(v2)/index.html` and `dist/(v2)/track.html` (literal-paren
URLs) plus `dist/_sitemap.html`. Pre-existing expo-router behavior for any route
group; harmless; canonical routes are correct.

### Version preference

- `lib/siteVersion.ts` — dependency-free (only a `type` import, erased at runtime)
  because `app/+html.tsx` is rendered by **Node** at export time and cannot import
  react-native/expo. Keep it dependency-free.
  - `type SiteVersion = 'v2' | 'legacy'`, `DEFAULT_VERSION = 'v2'`,
    `VERSION_STORAGE_KEY = 'wohl.siteVersion'`, `OTHER`, `LABEL`
  - `hrefFor(v, tab)` — returns **string literals**, never template literals
    (`` `/${v}` `` widens to `string` and fails typed-routes).
  - `versionFromPath(pathname)`, `tabFromPath(pathname)` — both tolerate a trailing
    slash (Cloudflare 308s `/legacy` → `/legacy/`).
- `lib/versionPreference.{ts,web.ts,native.ts}` — platform split mirroring
  `lib/database.*`. Web = `localStorage` (synchronous, guarded for
  `typeof window === 'undefined'` + try/catch for blocked storage). Native = its own
  `prefs.db` via expo-sqlite, deliberately separate from `tracker.db`.
  API: `getVersionSync`, `getVersion`, `setVersion`, `hydrateVersionPreference`.
- Two-layer redirect: (1) inline `<script>` in `+html.tsx` runs before the JS bundle
  loads, path-guarded to `pathname === '/'` only; (2) `useRestoreVersionPreference()`
  in `app/_layout.tsx` covers native + storage-blocked web. Only `/` is ambiguous —
  an explicit versioned URL always wins.
- `components/VersionSwitch.tsx` — 2-segment pill, absolutely positioned overlay
  mounted as a **sibling of `<Tabs>`** in each group layout.

## 4. HARD INVARIANTS — violating these breaks the product

1. **`VersionSwitch` MUST use `router.replace`, never `window.location`.**
   `lib/database.web.ts` is **in-memory** (line 1 says so). A hard navigation wipes
   the visitor's setup/activities/ratings mid-session. Highest-severity trap in the
   repo and invisible in review.
2. **`app/+html.tsx`'s gate script must stay path-guarded to `/`.** Without it,
   loading `/legacy` while the pref says `v2` bounces back and the switch becomes
   unusable.
3. **`lib/siteVersion.ts` must stay runtime-dependency-free** (Node imports it).
4. **Both versions share ONE database module instance.** Data written in v2 is
   visible in legacy and vice versa. Do not namespace it.
5. **`components/useColorScheme.ts` must return `'light' | 'dark'`, never null.**
   RN returns `null` when the OS preference is unavailable; that null previously
   reached `Colors[theme][colorName]` in `Themed.tsx` and threw.
6. **`getRegressionAnalysis` sorts its input ascending internally.** Do not "optimize"
   that away — `getFullDataset()` returns date-DESC and the lag pairing assumes
   oldest-first.
7. **Callers must label scatter points from `RegressionResult.dates[i]`**, not by
   indexing their own array. Under lag the analysis drops a row and shifts pairing.
8. **`wrangler.toml` must use `[[unsafe.bindings]]` with `type="ratelimit"`**, NOT
   `[[ratelimits]]`. Wrangler 3.114 silently discards the latter and
   `checkRateLimit()` fails open → uncapped OpenAI endpoints. See §7.
9. **`app/(v2)/*` and `app/legacy/*` are currently byte-identical.**
   `diff -q` passes on all three files. **§8 intentionally ends this.** Once the
   redesign starts, only `app/legacy/*` is frozen; retire the byte-identical check
   and replace it with "legacy renders as it does today".

## 5. DATA CONTRACTS — reuse unchanged; do not alter signatures

`lib/database.ts` is a 2-line TS-resolution shim (`export * from './database.web'`).
Metro picks `.web.ts` / `.native.ts` at runtime. **Both implement this contract and
were made to agree** (they previously diverged in 4 ways):

```ts
initDatabase(): Promise<void>
saveSetup(outcome: string, activities: string[]): Promise<void>
getSetup(): Promise<{outcome: string; activities: string[]} | null>   // null if no outcome OR no activities
getActivityLogs(date: string): Promise<Record<string, boolean>>
logActivity(name: string, completed: boolean, date: string): Promise<void>   // THROWS on unknown activity
getOutcomeRating(date: string): Promise<number | null>
logOutcomeRating(rating: number, date: string): Promise<void>
getFullDataset(): Promise<Array<{date: string; activities: Record<string,boolean>; outcome: number|null}>>  // date DESC
getAllActivityLogs(): ...   // DEAD CODE, no callers
populateDummyData(data): Promise<{inserted: number; skipped: number}>   // skips dates holding real data
clearSyntheticData(): Promise<void>   // per (date, activity) granularity on both platforms
saveWhoopToken(access: string, refresh?: string): Promise<void>
getWhoopToken(): Promise<string | null>
saveWhoopData(rows): Promise<void>
getWhoopData(start?, end?): Promise<rows>   // date DESC
```

```ts
// lib/analysis.ts
interface CheckIn { date: string; activities: Record<string, boolean>; outcome: number }
interface ActivityImpact { activity: string; coefficient: number;
  impact: 'strong positive'|'moderate positive'|'neutral'|'moderate negative'|'strong negative' }
interface RegressionResult {
  impacts: ActivityImpact[]; r2: number; sampleSize: number;
  method: 'multiple-regression' | 'pearson-correlation';
  predictions?: number[]; actuals?: number[];
  dates?: string[];   // date of the OUTCOME each aligned row predicts
}
generateDummyData(months = 6, userActivities: string[] = []): CheckIn[]
getRegressionAnalysis(data: CheckIn[], useLag = false): RegressionResult
generateInsightSummary(results: RegressionResult): string   // pre-formatted blob; DO NOT render in v2
enrichDataWithWhoop(activityData: CheckIn[], whoopData): CheckIn[]
```

Method switch: `alignedData.length < 10` → `pearson-correlation` (bounded r, -1..1);
else `multiple-regression` (**unbounded outcome POINTS**). `classifyImpact` already
applies different thresholds per method. **These two units cannot share a display
format.** Pearson → `r ±0.42`. Regression → `±0.42 pts`.

```ts
// lib/api/weeklyPlan.ts
interface WeeklyPlan { summary: string; rationale: string; guidelines: string[]; days: WeeklyPlanDay[] }
buildWeeklyPlanPayload(outcomeGoal: string, regressionResult: RegressionResult, validData, options?)
generateWeeklyPlan(payload): Promise<WeeklyPlan>   // POST {base}/api/weekly-plan; THROWS Error(message)

// lib/whoop.ts
isWhoopConfigured(): boolean        // false in all current builds
getWhoopAuthUrl(): string          // THROWS when not configured
exchangeCodeForToken(code): Promise<{access_token, refresh_token}>
getWhoopCycles|getWhoopRecovery|getWhoopSleep(token, start, end)
formatWhoopDataForAnalysis(cycles, recoveries, sleeps)
getWhoopAccessToken()              // DEAD CODE, no callers

// lib/dateKey.ts
dateKey(d = new Date()): string    // LOCAL 'YYYY-MM-DD'. Use for ALL calendar keys.
                                   // toISOString() is UTC and files evening check-ins
                                   // a day forward west of UTC. External API timestamps
                                   // still want real UTC instants.

// lib/apiBase.ts
getApiBase(): string | null        // '' on web (same-origin), dev-host guess on native, null if unresolvable
```

## 6. VERIFICATION — run these; they are the only automated gates

```bash
npm install                 # node_modules is NOT committed
npm run typecheck           # MUST be 0 errors. Was 27 at baseline; now 0. Keep it 0.
npm run verify              # 30 assertions across analysis + storage. MUST be 0 failures.
npm run web                 # Metro dev server, :8081
npm run cf:dev              # real Workers runtime via Miniflare (closest to prod)
```

- `scripts/verify-analysis.mjs` — regression math, lag direction, r2 finiteness,
  dateKey locality, sample-data signal quality.
- `scripts/verify-storage.mjs` — drives the real web storage module through
  log-real → generate-sample → delete-sample and asserts real data survives.
- `scripts/ts-resolve.mjs` — Node ESM resolve hook so those scripts can import the
  app's extensionless `.ts` modules the way Metro/tsc do. Required `--import` flag.
- **Node is not on PATH by default in this environment.** Prefix:
  `export PATH="$HOME/.nvm/versions/node/v24.19.0/bin:$PATH"`
- There is **no test runner and no linter**. `typecheck` + `verify` is the whole net.

Manual gate for the version split:
1. `/`, `/track`, `/legacy`, `/legacy/track` all render.
2. Toggle the pill from `/track` → must land `/legacy/track` (tab preserved).
3. **Enter a setup on one version, toggle, confirm activities persist.** If they
   vanish, something did a hard navigation and wiped the in-memory store.
4. Set pref to legacy, hard-reload `/` → must land `/legacy`. Load `/track`
   explicitly with pref=legacy → must STAY on `/track`.

## 7. STATE OF THE TREE

20 commits ahead of `origin/main`, **nothing pushed**. Working tree clean.
`631ff75` (tab-bar sizing) was pre-existing and unpushed; the other 19 are this work.

```
d138c19 fix: misleading impact values, midnight rollover, and frequency math
255fe90 fix(whoop): wrong calendar day, fabricated zeros, and lost readings
98693ca fix(ui): stale results, hidden table columns, and escaping scatter points
6dc6ce6 fix(storage): make web and native actually implement the same contract
5c2a7f9 fix(analysis): -Infinity R², noise-only sample data, and lag across gaps
2fe0bfd fix(storage): sample data destroyed real check-ins
4452eba fix(cloudflare): the rate limiter was never actually active
4cdae72 fix(track): confirm before deleting, and handle dev-tool failures
f63100c fix: restore the missing tab icons and the crashing theme hook
6327c51 fix(setup): free the Save button and stop swallowing failures
c39db44 fix(track): handle failures instead of lying about them
992cc1f fix: derive the check-in date key from local time, not UTC
71132e2 fix(analysis): "Next-day" correlated activities with the PREVIOUS day
87612cf fix(whoop): only the focused Track screen handles the OAuth deep link
b124bf9 feat: add the version switch pill
834f940 feat: add a persisted site-version preference
2f54ead feat(router): fork the frozen legacy copy at /legacy
4240155 refactor(router): rename the tab group to (v2)
1cb0cff chore: remove dead Expo template code
```

### ALREADY FIXED — do not re-report or re-fix

Analysis: inverted "Next-day" lag (DESC vs ASC — reported the *opposite sign*);
`R² = -Infinity` on zero-variance outcomes; sample data containing no learnable
signal (impact was redrawn per-day; r² went 0.05 → 0.75 after fixing); lag pairing
across calendar gaps; scatter points labelled with the wrong date.

Storage: `populateDummyData` overwriting real check-ins and marking them synthetic
so "Delete Sample Data" destroyed them; native `saveSetup` unable to remove an
activity; per-date vs per-row synthetic granularity; generated activity names
polluting the user's setup list; native `logActivity` silent no-op; `|| null`
turning a legitimate 0 into "no data".

Screens: Setup's Save button trapped inside the hypothesis conditional; bare
`catch {}`; unguarded `saveSetup`; missing loading states; hypothesis response
races (both on resolve and on clear); optimistic writes with no rollback;
`handleRunAnalysis` with no try/catch and no loading state; stale scatter surviving
a pearson-path run; `DataTable` taking columns from `data[0]`; unclamped scatter
positions escaping the plot box; destructive delete with no confirmation; leaked
easter-egg timers on both screens; a weekly-plan "auto-refresh" that regenerated
from data the new rating was never in; `today` captured per render (midnight
rollover).

Platform/infra: tab bar rendering **no icons on any platform** (`SymbolView.name`
takes a string not a per-platform object, and its web impl is `return props.fallback`
which was never passed — replaced by `components/TabBarIcon.tsx`);
`useColorScheme` returning null and crashing `Themed`; `lib/database.native.ts`
declaring `let db: any` with the open-guard repeated 15× (opted the whole storage
layer out of typechecking); the Cloudflare rate limiter never being active.

WHOOP (path is unreachable while unconfigured, but fixed): UTC-vs-local date keys;
sleep keyed on bedtime instead of wake time; missing readings scored as `0` i.e.
"recovery was not high"; null-vs-undefined divergence producing different column
sets per platform.

### OPEN — needs a human decision, do not silently resolve

1. **`expo-sqlite` is pinned `^55.0.10` but Expo SDK 54 expects `~16.0.10`.** Expo
   warns "your project may not work correctly". Typing the storage layer proved the
   *API* matches, but native module compatibility is unverified. Web is unaffected
   (`database.web.ts`). **Every storage fix above lands in `database.native.ts` and
   is untested on device.**
2. **All fixes were applied to `app/legacy/*` too**, on the reasoning that legacy is
   frozen in *appearance* and shipping known data loss is the wrong kind of
   faithfulness. If the owner wants legacy bit-faithful to the hackathon behavior,
   this is reversible.
3. **WHOOP's web OAuth redirect targets `/whoop-callback`, which has no route** → a
   pre-existing 404. Currently unreachable because `isWhoopConfigured()` fails first.
   Fixing it means adding `app/whoop-callback.tsx`.
4. `dist/_sitemap.html` is publicly reachable and lists the route structure.
5. Dead code retained: `getAllActivityLogs`, `getWhoopAccessToken`, `getVersionSync`.

---

## 8. NEXT TASK — v2 REDESIGN

### 8.1 Mandate

Owner's words: *"Analyze the whole site and make improvements to every element with
the end goal being a more modern, better-flowing, polished website. Keep basic color
scheme and functionality."* Chosen depth (explicit): **"Full rethink of flow"** —
rework the information architecture, not just the styling.

### 8.2 Scope boundary

- **EDIT:** `app/(v2)/index.tsx`, `app/(v2)/track.tsx`, `app/(v2)/_layout.tsx`, and
  new files under `constants/`, `components/ui/`, `components/v2/`.
- **DO NOT EDIT:** `app/legacy/*`. It is the frozen before-picture. Screenshot
  `/legacy` and `/legacy/track` before starting; they must look the same after.
- **DO NOT EDIT** `constants/Colors.ts`'s `Brand` export, or
  `components/track/{DataTable,ScatterChart,WeeklyPlanCard,WhoopPanel}.tsx`, or
  `components/ImpactChart.tsx`. Legacy imports all of them; restyling them changes
  legacy's rendering. **v2 gets its own display components under `components/v2/`.**
  Most get genuinely redesigned anyway, so this is new work, not copy-paste.
- **DO NOT change any `lib/` signature.** Reuse the §5 contracts verbatim.

### 8.3 Design tokens — new file `constants/theme.ts`

Import `Brand` and re-export under semantic role names. Introduce **no new hex**
except tokenizing the 11 `rgba()` literals currently inline in the shared
components. Leave `Brand` untouched.

**Two-blues resolution — this is measured, not preference.** WCAG contrast on white:

| token | hex | contrast | verdict |
|---|---|---|---|
| `Brand.blue` | `#4a90e2` | **3.29:1** | fails 4.5:1 normal text; passes 3:1 large-text + UI |
| `Brand.accentBlue` | `#2563eb` | **5.17:1** | passes normal text |

They are one ramp with two jobs, not competing primaries:
- `primary = #4a90e2` — fills carrying **≥16px/700 white** text, borders, tints.
- `primaryStrong = #2563eb` — blue **text/icons on white**, small-text fills,
  selected control states (checkboxes, rating pills). Also the data-viz ink.
- `brand = #f55e61` (coral) — identity only: wordmark, add button, edit affordance.
  **Never use coral to mean "negative"** — it would make the brand color mean "bad".

**Two more measured failures currently shipping as label text — fix in v2:**
- `Brand.inkFaint #999999` = **2.85:1**. Used as `placeholderTextColor`, the
  "Template" badge, and chip `×`. Use `inkSoft #666666` (5.74:1) for all
  captions/placeholders; reserve `#999` for decoration.
- `Brand.slateFainter #94a3b8` = **2.56:1**. Use `slateFaint #64748b` (4.76:1).
- `Brand.success #059669` = 3.77:1, so its 14px/700 white labels also fail.

**Chart pair — validated for color-vision deficiency, not eyeballed:**

| pair | worst CVD ΔE | contrast | verdict |
|---|---|---|---|
| current `#10b981` / `#ef4444` | **8.1** (deutan) | `#10b981` = 2.54:1 FAIL | at the floor |
| **use** `#2563eb` / `#dc2626` | **29.9** (protan) | both ≥3:1 | 3.7× separation |

Diverging midpoint = `#64748b` (neutral gray). Retire green from charts.

**Type scale — 6 core sizes replacing 13 ad-hoc ones**, every one with a paired
lineHeight (only 9 of 66 current declarations have one):
`display 40/44 · h1 28/34 · h2 20/26 · body 16/24 · small 14/20 · caption 12/16`.
Weights 400/500/600/700 only. Use `fontVariant: ['tabular-nums']` for numeric
alignment — **do not reintroduce the SpaceMono font** (it was deleted; it blocked
first paint for dead code).

`space 4·8·12·16·24·32·48` · `radius 8·12·16·pill` · 3 elevation levels ·
`layout: {maxWidth: 680, gutter: 24, sectionGap: 32, tabBarHeight: 80, minTouch: 44}`.
The 680/24/32 values reconcile Setup's current 600/32/40 against Track's 700/24/32 —
the two screens are visibly inconsistent in rhythm today.

**TS gotcha:** a plain object literal infers `fontWeight: string`, which is not
assignable to RN's `TextStyle['fontWeight']` literal union under `strict`. Declare
the type scale with `satisfies Record<string, TextStyle>` or every
`style={type.h1}` errors.

### 8.4 Primitives — `components/ui/`

Measured duplication justifying each (all verified):
- `input` is **byte-identical** in `app/(v2)/index.tsx` and `components/track/WhoopPanel.tsx`.
- A full table impl is copy-pasted verbatim between `DataTable.tsx` and
  `WhoopPanel.tsx`; `ImpactChart.tsx` hand-rolls a **third**, differently styled.
- `section`/`sectionTitle` declared **3×** identically.
- A card surface appears independently **3×**.
- A pill/toggle pattern written **3×** (`ratingButton`, `lagToggleButton`, `chip`).
- There are currently **zero** reusable primitives in the repo.

Build, in priority order: `Text` (variant-keyed — this is the mechanism that stops
6 sizes drifting back to 13), `Card` (with a `busy` prop that holds the previous
render at ~0.45 opacity instead of blanking — needed for the filter re-run below),
`Button` (variants primary/hero/secondary/ghost/danger/quiet; enforces
`minHeight: 44`, one disabled path, and auto-upgrades small-text fills to
`primaryStrong`), `Field` (owns the label↔input association via `nativeID` +
`accessibilityLabelledBy`; current section headings are plain `Text` with no
association), `Section` (collapsible header gets `accessibilityRole="button"` +
`accessibilityState={{expanded}}` and a ≥44px hit area), `Pill`/`PillGroup`,
`DataGrid` (replaces all three tables), `Callout`, `StatTile`, `Meter`.

**Do not use `components/Themed.tsx` in v2.** It injects `Colors.light.text` =
`#000` (not `#1a1a1a`) per text node for a dark-mode system these screens don't
participate in.

### 8.5 v2 Setup — guided flow (`app/(v2)/index.tsx`)

Replaces one long form. `type Phase = 'loading'|'form'|'summary'`,
`type Step = 'outcome'|'activities'|'review'`. One screen component, one ScrollView,
a `step` state — **not** three routes (state must survive; step 3 must stay mounted
so the debounce isn't restarted).

- **loading** → skeleton, not an empty form.
- **Step 1 Outcome** — one large `Field`, plus tappable example chips ("more energy",
  "better sleep", "feel less anxious") to kill the blank-page problem. 3-segment
  progress indicator (`accessibilityRole="progressbar"`), tappable back to completed
  steps only. `Next` is **never truly disabled** — always pressable; on press it
  either advances or sets an inline error. A disabled button tells a screen reader
  nothing about *why*.
- **Step 2 Activities** — `Field` + trailing coral `+`, chip cloud with `onRemove`.
  **Hint must state that commas split into multiple chips** — `handleAddActivity`
  already does this and nothing in the UI says so. Inline feedback for duplicate
  and blank adds (currently silent no-ops). Make de-dup case-insensitive +
  whitespace-normalized (currently case-sensitive). Starter chips. `numberOfLines={2}`
  in **both** form and summary (currently 1 vs unbounded).
- **Step 3 Review** — the raw `outcome` text (**the current summary never shows it**),
  the chips, and the hypothesis `Card` with `busy` (loading), `AI generated` /
  `Template` badge, and on failure a `Callout` that explicitly says saving still
  works. Footer: `Save & continue` + `Cancel`.
- **Save must stay a SIBLING of the hypothesis card**, gated only on
  `canSave = outcome.trim() && activities.length > 0`. This was already fixed in the
  current code — do not regress it. Keep `HYPOTHESIS_DEBOUNCE_MS = 600` and the
  generation counter.
- **summary** → a real summary card (outcome + hypothesis + chips + `Edit setup`
  outlined coral + `Regenerate hypothesis` ghost). `Edit setup` should land on
  **review**, not step 1 — editing is usually a tweak.
- Content **left-aligns**; only wordmark and progress stay centered. This single
  change is the largest "modern" delta; everything is currently centered.
- `KeyboardAvoidingView` over **both** phases, `behavior` `'padding'`/`'height'`
  (currently `undefined` on Android), `keyboardVerticalOffset` from the token.

### 8.6 v2 Track — dashboard-first (`app/(v2)/track.tsx`)

**This is the headline fix.** Current IA: header → activities → rating → **one
accordion labeled `🧪 Testing & Analytics`, collapsed by default**, containing
dummy-data + clear-data buttons, WhoopPanel, the lag toggle, Run Analysis, the plan
button, the error box, the insights box, ImpactChart, WeeklyPlanCard, ScatterChart,
DataTable — with WhoopDataTable orphaned *outside* it at the very bottom. So the
entire value of the app is collapsed and co-located with dev tooling.

Split into three separated concerns:

1. **Header** — `<Wordmark/>` (see below), local date, compact stat row.
2. **Today's check-in** (Card, always visible) — activity checkboxes with a
   "3 of 5 done" `Meter`; 1–10 rating as a `PillGroup` with anchor labels
   ("Rough" → "Great") and a way to clear. Add `accessibilityRole="checkbox"` +
   `accessibilityState` and ≥44px rows (absent today). Inline fading "Saved" —
   **zero `alert()` in v2** (13 in `app/(v2)/track.tsx` today, 0 in `index.tsx`; RN
   polyfills `global.alert` to `Alert.alert`, so they *work*, they're just wrong UX.
   Several were added by the bug-fix pass as rollback/error notices — those need
   real inline `Callout`s, not deletion).
3. **Headline stats** (always visible) — `StatTile` hero "7-day average" with delta
   + 12-point sparkline, "Days logged", "Current streak". Derived from
   `getFullDataset()` only — **no regression**, so it's cheap enough to auto-load
   on focus. This is what makes it read as a dashboard.
4. **What's working** (always visible) — three states:
   - *not enough data* (`daysLogged < 10`): `Meter value={daysLogged} max={10}` with
     a hint that a full model needs 10 days and simple correlations are shown until
     then. This surfaces the `alignedData.length < 10` method switch that is
     currently completely invisible to the user.
   - *ready, not run*: `Button variant="hero"` + `BeakerIcon` in an empty-state card.
   - *results*: `InsightList` built from `regressionResults.impacts` **directly**.
     **Do not render `generateInsightSummary()`'s string blob** — that string is the
     reason `safeSetInsights` and the `planError.trim() !== '.'` triple-guards exist;
     delete that whole concept in v2 and use `{x ? <Text>{x}</Text> : null}`.
     Copy **must branch on `method`**: regression → "On days you {activity}, your
     rating is about **0.4 points** higher"; pearson → "{activity} tends to go
     together with **higher** ratings (weak/moderate/strong)" — **never** a "points"
     claim. No bare coefficient in primary copy; exact numbers behind a
     "Show details" disclosure.
     Then `ImpactBars` — a **diverging horizontal bar chart**, not a value-ramp
     heatmap (the current ImpactChart interpolates lightness by `|coef|/maxAbs` over
     nominal categories, double-encoding as color what bar length already shows).
     Bars ≤24px, rounded data-end, square at the baseline, solid hairline center
     axis, value at the tip, names/values in **text** tokens never the series color,
     a "helps/hurts" scale key (not a series legend), and a "Show as table" toggle
     into `DataGrid`.
     Then `FitScatter` — real SVG `<Circle r=5>` with a 2px surface ring for
     overlap legibility (currently absolutely-positioned Views with `opacity: 0.7`),
     solid y=x hairline (currently dashed), clamped positions. Under it, R² in plain
     language: "explains about 18% of the day-to-day change — a weak fit, so treat
     these as hints." Bands <0.2 weak / 0.2–0.5 moderate / >0.5 strong.
5. **Your week** — the plan, with inline Generate/Regenerate. `WeeklyPlanCard` may be
   reused verbatim initially to ship faster; a v2 original is optional.
6. **Data** — collapsed by default: scatter + recent check-ins `DataGrid`.
7. **Developer tools** — LAST, collapsed, `quiet` styling, honestly labeled.
   Sample data, `Delete Sample Data` (keep the existing two-step confirm; do **not**
   use `Alert.alert` — unreliable under react-native-web and this app is web-first),
   the WHOOP token `Field` gated on `isWhoopConfigured()`, and **move
   `WhoopDataTable` inside** instead of orphaning it at page bottom.

**Filter row** — Same-day/Next-day as a `PillGroup` in section 4's `Section action=`
slot, scoping everything below it. **Changing it must re-run the analysis
immediately** (today it doesn't, so displayed results silently belong to the previous
setting). Hold previous results at 0.45 opacity via `Card busy` — no blanking, no
layout jump. One-line explainer of what the two modes mean.

**Auto-run policy (hybrid, deliberate):** auto-run the cheap pass (`getFullDataset`
→ stats/streak/sparkline) on focus. Keep the **regression explicit** on first run —
`getRegressionAnalysis` runs `ml-regression` synchronously on up to ~181 rows on the
JS thread, so auto-running it on every focus would jank navigation. After a check-in
changes, show a ghost "Your data changed — refresh results" rather than silently
stale numbers or a surprise recompute.

**Implementation detail that is easy to miss:** setting a busy flag and calling
`getRegressionAnalysis` in the same tick means **the spinner never paints** — the
synchronous regression blocks before React commits. The current code already yields
with `await new Promise(r => setTimeout(r, 0))`; keep that (or
`InteractionManager.runAfterInteractions`).

**Auto-scroll to results** after a run — `ScrollView` ref + `onLayout` on the results
card. Results currently appear far below the fold with no cue.

### 8.7 `components/v2/Wordmark.tsx`

Extract the duplicated `handleBrandTap` + `brandTitle` from both screens. Owns
`tapCount`/`showDinos`/`LaserDinosaur` internally with a `useRef` timer cleared on
unmount. Props `{size?: 'lg'|'sm'; align?: 'left'|'center'}`.

**PRESERVE THE EASTER EGG EXACTLY: 5 taps on the "wohl" wordmark spawns 3
`LaserDinosaur`s for 3500ms.** It is intentional and the owner likes it.

### 8.8 Commit sequencing

Each step must build and run.

1. `chore(theme): add the v2 design-token layer` — `constants/theme.ts` only, no consumers.
2. `feat(ui): add Text, Card, Button, Field, Section primitives`
3. `feat(ui): add Pill, PillGroup, Callout, DataGrid, StatTile, Meter`
4. `feat(v2): rebuild Setup as a guided flow` + `components/v2/Wordmark.tsx` — first user-visible v2 artifact
5. `feat(v2): dashboard-first Track — check-in and headline stats`
6. `feat(v2): plain-language insights and a diverging impact chart`
7. `feat(v2): predicted-vs-actual scatter with a plain-language fit summary`
8. `feat(v2): weekly plan section` — feature parity reached
9. `feat(v2): move dev tooling into a collapsed drawer`
10. `docs: document the v1/v2 split` — README, `.kiro/steering/project-context.md`, CLOUDFLARE.md

### 8.9 Definition of done

- `npm run typecheck` → 0 errors. `npm run verify` → 0 failures.
- `/legacy` and `/legacy/track` render **pixel-identically to the pre-redesign
  screenshots**. `git diff` on `app/legacy/` across the whole redesign is empty.
- Every feature in §8.6's list still reachable and working.
- Coral + blue identity intact; no green in charts; no color below 4.5:1 used as
  label text.
- `alert()` count in `app/(v2)/` is **0**.
- Setup: `Save & continue` reachable **with the Express server stopped** (hypothesis
  falls back to template).
- Track: `Generate sample data` → insights, impact chart, scatter and table all
  visible **without opening any accordion**. Toggling Same-day/Next-day re-runs
  immediately. Scatter date labels correct under Next-day.
- Data written in v2 visible in legacy and vice versa.
- Wordmark easter egg works on both v2 screens and leaks no timer.
