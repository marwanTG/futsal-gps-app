# Futsal GPX Match Analysis

A browser app that turns GPX files from an Amazfit / Zepp watch into a futsal
match report: sprints, speed and heart-rate zones, heatmaps, attack/defense
arrows, fatigue, cross-match comparison and a relative player profile.

Everything runs on your device. No file is uploaded and no network is needed
after the page loads.

## Use it

- Open `dist/index.html` in Chrome or Edge (double-click works; it is one
  self-contained file).
- Drop one or more `.gpx` files on the **Matches** tab. Duplicates (same start
  time) are skipped.
- For each match, set the direction of your own goal, confirm it, mark
  goalkeeper / bench / injury periods and trim the end if the watch kept
  recording. Every number recomputes instantly.
- Data is saved in the browser (IndexedDB) on this computer only.

## Develop

```
npm install
npm run dev      # local dev server
npm test         # unit tests (analysis module)
npm run build    # type-check + single-file build to dist/index.html
node scripts/make-sample.mjs work/sample.gpx   # synthetic match
node scripts/smoke.mjs work/sample.gpx         # browser smoke test + screenshots
```

Put the six reference GPX files in `fixtures/gpx/` and `npm test` also checks
them against the reference table in `brief.md` section 9.

## Method (plain language)

- **Speed** comes from the watch's own speed field (m/s × 3.6). If a watch does
  not write speed, it is computed from positions and the match card says so.
- **Distance** is the sum of haversine distances between consecutive points.
- **Active minutes** are seconds with speed above zero, outside excluded
  periods. All "per hour" rates use active minutes, so long matches do not get
  an advantage.
- **Exclusions** (goalkeeper, rest, injury) are removed from active time,
  position maps and zone stats. A sprint never crosses an excluded period.
- **Goalkeeper vs bench** look the same in GPS. The app only suggests
  low-movement windows (60 s window, radius under 6 m, mean speed under
  2 km/h, at least 90 s) and you decide what each one was.
- **Burst** = above 6 km/h for at least 2 s. **Sprint** = a burst that reaches
  above 8 km/h. All thresholds are adjustable in Settings.
- **Attack / defense** is the direction of travel along the goal axis (end
  minus start), not where the sprint started.
- **Pitch frame**: positions are projected to metres, rotated so the own goal
  is at the bottom (optionally snapped to the dominant movement axis), and
  normalised to the 1st-99th percentile box. A side swap at a given minute
  flips the frame. Matches without a confirmed orientation are left out of
  directional stats unless you include them.
- **Acceleration** is the change in speed per second. At 1 Hz peaks are
  smoothed, so acceleration and speed are lower bounds.
- **Profile scores** (0-100) are min-max normalised across your own matches.
  They compare you with yourself, never with other players.

## Limitations

- 1 Hz consumer GPS under-reads speed and acceleration, especially on small or
  covered pitches. Do not compare these numbers directly with professional
  systems.
- GPS does not know where the ball is. Insights describe movement, not tactics.
- Pitch size is estimated from your own positions until a venue map is added.
- Benchmark values are hidden until each one is checked against its paper.
- The app is not a medical tool.

## Code layout

- `src/analysis/` — pure, tested logic: `parse`, `geo`, `detect`, `analyze`,
  `profile`, `insights`, `benchmarks`.
- `src/ui/` — React screens and SVG charts (d3 for scales, density contours,
  zoom).
- `src/store.ts` — IndexedDB persistence.

## Online saving (optional, Supabase)

Without configuration the app stays fully local, as above. With a Supabase
project, players can save their matches online (Google account, name with a
personal link, or email code), so nothing is lost when the browser storage is wiped, and
the owner sees every player's matches in the Supabase dashboard.

1. Create a free project at supabase.com.
2. SQL Editor → paste `supabase/schema.sql` → Run.
3. Authentication → Emails → "Magic Link" template: put `{{ .Token }}` in the
   body so the email carries a code (the app asks for the code, not a link).
4. Google sign-in: in console.cloud.google.com create an OAuth client (Web
   application) with redirect URI `https://xxxx.supabase.co/auth/v1/callback`
   and publish the consent screen (email/profile scopes need no review). Paste
   the client id and secret in Supabase → Authentication → Providers → Google.
   In Authentication → URL Configuration set the Site URL and a Redirect URL to
   `https://marwantg.github.io/futsal-gps-app/`.
5. Project Settings → API: copy the Project URL and the anon public key into
   `.env` (not committed):
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
6. `npm run build` / `bash scripts/deploy-pages.sh`.

Viewing data: Table Editor → `matches_overview` (one row per match with the
player's name), `players`, `matches`. The local IndexedDB copy stays the main
copy; failed uploads are queued and retried when the internet returns. Health
notes never leave the phone. Test: `node work/cloud-test.mjs` (fake server).
