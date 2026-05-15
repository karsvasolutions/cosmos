# Cosmos — Immersive Space Imagery Site

**Date:** 2026-05-16
**Status:** Design approved, ready for planning

## Purpose

A website that displays the latest high-resolution images from space in an immersive, photo-first experience. The aim is to create a sense of wonder: minimal UI, dark theme, one image at a time, with optional background information available on demand. Sources are credited.

## Non-goals

- Sharing or bookmarking individual images
- User accounts or saved favorites
- Search or filtering (by source, date, telescope, etc.)
- Mobile-specific gesture polish beyond what scroll already provides
- Analytics

## Experience

**Default state.** A single image fills the viewport on a solid black background. Image uses `object-fit: contain`, centered. Two tiny pieces of chrome:

- Bottom-left: `TITLE · CREDIT` — 10px, letter-spacing 2px, color `#777`.
- Bottom-center: `↑ read` cue — same weight, indicates info is available.

No title, no header, no nav. The domain name is the only branding.

**Advancing.** Press `↓`, `Space`, or click/tap anywhere outside the read cue → next image with a ~400ms cross-fade. Press `↑` to go back within session history (the list of advances in the current tab; not persisted across reloads). On touch devices, a downward swipe also advances. Order is shuffled per visit. When the user reaches the end of the batch, the list re-shuffles and continues from the start (infinite loop).

**Info reveal.** Click the `↑ read` cue or press `i` → a translucent bottom sheet slides up over the bottom ~55% of the viewport. The image stays visible behind it. The sheet contains:

- Title (16px)
- Date the image was released
- Full description (plain text, may be 1–3 paragraphs)
- Credit line
- A link to the source page on `nasa.gov` / `esahubble.org` / `esawebb.org`

`esc` or clicking the image area closes the sheet. Advancing to the next image also closes it. While the sheet is open, click/tap on the image area closes the sheet rather than advancing; advancing requires `↓` / `Space` or closing first.

**Slideshow.** Off by default — the user controls pacing. Three controls reveal on input (mouse-move, keypress, or tap) and auto-fade after 3 seconds of inactivity:

- **Prev** (`‹`) — a circular button on the left edge, vertically centered.
- **Next** (`›`) — a circular button on the right edge, vertically centered.
- **Play / Pause** (`▶` / `❚❚`) — a circular button bottom-center, just above the read cue.

When playing, the viewer auto-advances every 12 seconds. Any manual input (click, ↓, ↑, swipe, ‹, ›) resets the 12-second timer but does NOT pause the slideshow. Pressing the Play/Pause button toggles state. Keyboard shortcut: `p` toggles play/pause.

Controls are styled to match the rest of the chrome — translucent disc with `backdrop-filter: blur(8px)`, `var(--text-muted)` border, white glyph on the active button. They never overlap the read cue, credit label, or info sheet. When the info sheet is open the slideshow pauses automatically and resumes when the sheet is closed (if it was playing before).

On touch devices, any tap reveals the controls and resets the 3-second fade timer; tapping the image (outside any control) continues to advance.

## Architecture

Static site, built with Astro, deployed to Vercel free tier. Daily rebuild via GitHub Actions cron.

```
┌─────────────────────────────────────────────────────────────┐
│  GitHub Actions (daily at 12:00 UTC)                        │
│  └─ npm run fetch                                           │
│      └─ ingest script → data/images.json (max 500 entries)  │
│      └─ commits & pushes if changed                         │
│                                                             │
│  Astro build (Vercel)                                       │
│  └─ reads images.json → emits static HTML/JS/CSS            │
│                                                             │
│  Browser                                                    │
│  └─ loads images.json once, shuffles client-side,           │
│     renders one image fullscreen, advances on input         │
└─────────────────────────────────────────────────────────────┘
```

Image binaries stay on NASA's CDN — the site stores only URLs and metadata. Expected `images.json` size: 200–400 KB for 500 entries.

## Data model

```ts
type Image = {
  id: string;              // stable hash, e.g. "apod-2026-04-22"
  source: "apod";          // NASA APOD is the sole source for beta
  title: string;           // "Cosmic Cliffs in the Carina Nebula"
  date: string;            // ISO date the image was released (YYYY-MM-DD)
  credit: string;          // "NASA, ESA, CSA, STScI"
  sourceUrl: string;       // canonical page on apod.nasa.gov
  imageUrl: string;        // APOD's `hdurl` (the highest-resolution variant)
  imageUrlPreview?: string;// smaller variant for preload, if available
  width?: number;          // when known — prevents layout shift
  height?: number;
  description: string;     // plain text, 1–3 paragraphs
};
```

`data/images.json` is `Image[]`, sorted by `date` desc, capped at 500.

**Normalization rules:**

- `description` — strip HTML from feed content. Preserve the full APOD explanation; only apply a safety cap at 5000 characters (truncate at a word boundary, append `…`) so a single misbehaving entry can't blow up the JSON. The info sheet scrolls if the text overflows.
- `imageUrl` — uses APOD's `hdurl` (the highest-resolution variant). Entries without an `hdurl` fall back to the regular `url`.

**Filtering rules:**

- Entries where `media_type !== "image"` (videos) — skipped.
- Entries missing a credit string (`copyright`) — skipped. APOD includes credit for nearly every image.
- Duplicates (same `imageUrl`) — first occurrence wins.

## Repository layout

```
src/
  pages/
    index.astro              ← the only page; renders <Viewer/>
  components/
    Viewer.astro             ← container; embeds images.json + script
    ImageSlide.astro         ← one fullscreen slide (server-rendered shell)
    InfoSheet.astro          ← the bottom-sheet markup
  scripts/
    viewer.ts                ← shuffle, advance, preload, key handlers
    info-sheet.ts            ← open/close the sheet
  styles/
    globals.css              ← reset + dark theme tokens
data/
  images.json                ← produced by ingest script (committed)
ingest/
  index.ts                   ← entrypoint for `npm run fetch`
  sources/
    apod.ts                  ← APOD adapter (sole source)
  normalize.ts               ← Image shape + filters
  write.ts                   ← merge, sort, cap to 500, write JSON
.github/
  workflows/
    daily-fetch.yml          ← cron + commit + push
    ci.yml                   ← build + tests on every push
```

## Components & modules

### `Viewer.astro` + `viewer.ts`

Responsibilities:

- On load: read embedded `images.json`, shuffle with a fresh seed (random per visit), pick index 0, preload index 1 in the background.
- Render the current image with `object-fit: contain` on a solid `#000` background.
- Handle input: `↓` / `Space` / click → next; `↑` → previous (within session history); `i` → toggle info sheet; `esc` → close sheet.
- Cross-fade between images (~400ms).
- On every advance, inject a `<link rel="prefetch">` for the next image's `imageUrl`.
- When index reaches end of array: re-shuffle, reset to 0, continue.
- On image `error`: remove that entry from the in-memory list, log to console, advance to next.

### `InfoSheet.astro` + `info-sheet.ts`

Responsibilities:

- Render markup for the title, date, description, credit, and source link.
- Slide-up animation (~250ms) over the bottom 55% of the viewport.
- Translucent panel: `rgba(10,10,15,0.95)` + `backdrop-filter: blur(6px)` + 1px top border `rgba(255,255,255,0.08)`.
- Close on `esc`, on click of image area, or on advance.

### `ingest/` — data pipeline

`ingest/index.ts` is the entrypoint run by `npm run fetch`:

1. Calls the APOD adapter.
2. If it throws, logs the error.
3. Dedupes by `imageUrl`, sorts by `date` desc, caps at 500.
4. If the result has fewer than 50 entries → exits non-zero (build fails loudly).
5. If `--keep-on-empty` is passed and the result is empty/below threshold, retains the existing `data/images.json`.
6. Writes `data/images.json`.

**Source endpoint:**

- **APOD** — `https://api.nasa.gov/planetary/apod?api_key=$NASA_API_KEY&start_date=…&end_date=…`. Page backwards from today in ~100-day windows until ~500 image entries collected (skipping videos).

The adapter lives in `ingest/sources/apod.ts` and exports a single `fetchApod(opts): Promise<Image[]>` function returning normalized entries.

## Error handling

| Scenario | Behavior |
|---|---|
| The APOD adapter fails | Log it; the merged result will be empty, falling through to the threshold check. |
| Merged ingest result < 50 entries | Build fails with non-zero exit. |
| `images.json` fails to load in browser | Show 9px corner message "Loading the cosmos…"; retry once after 2s. |
| Image `<img>` fires `error` | Remove entry from in-memory list, log, advance to next. |
| User reaches end of array | Re-shuffle and continue from index 0. |

## Visual design system

The site is editorial-photography minimal: a fullscreen image, near-invisible chrome, restrained typography reserved for the info sheet. References: photo-essay sites, museum exhibition pages, Mast/Apple product photography.

### Typography

Pairing: **Playfair Display** (info-sheet title) + **Inter** (everything else). Editorial serif for the title only — it's the one moment the site lets typography speak. Inter at small sizes with high letter-spacing makes the chrome read as "label," not "text."

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&family=Playfair+Display:wght@500;600&display=swap');
```

Type roles:

| Role | Font | Size | Tracking | Color |
|---|---|---|---|---|
| Chrome label (credit / `↑ read`) | Inter 400 | 10px | 0.2em | `--text-muted` |
| Info-sheet title | Playfair Display 600 | 22px | -0.01em | `--text-primary` |
| Info-sheet meta (date, source link) | Inter 400 | 11px | 0.1em | `--text-secondary` |
| Info-sheet body | Inter 400 | 14px | 0 | `--text-secondary` |

Body uses `line-height: 1.65` and `max-width: 60ch` for comfortable reading.

### Color tokens

```css
:root {
  --canvas:           #000000;
  --text-primary:     #FAFAFA;       /* info sheet title */
  --text-secondary:   #B0B0B0;       /* info sheet body */
  --text-muted:       #777777;       /* chrome labels — meets 4.5:1 on #000 */
  --hairline:         rgba(255,255,255,0.08);
  --sheet-bg:         rgba(10,10,15,0.92);
  --focus-ring:       rgba(220,220,255,0.65);
}
```

All text/background combinations meet WCAG AA (4.5:1) on `#000`.

### Motion tokens

| Token | Duration | Easing | Notes |
|---|---|---|---|
| `--motion-fade` | 400ms | ease-in-out | image cross-fade on advance |
| `--motion-sheet` | 250ms | ease-out | info-sheet slide-in |
| `--motion-cue` | 200ms | ease | hover/focus on cue |

When `@media (prefers-reduced-motion: reduce)` matches: cross-fade is replaced with an instant swap, sheet appears without slide (opacity only, 100ms). No parallax or scroll-jacking effects anywhere.

### Accessibility requirements

- An off-screen `<h1 class="sr-only">` reads "Cosmos — high-resolution images from space" for SEO and screen readers.
- Each `<img>` has `alt={title}` (the image title, e.g. "Cosmic Cliffs in the Carina Nebula").
- The info-sheet source link has a visible `:focus-visible` ring (`outline: 2px solid var(--focus-ring); outline-offset: 2px`). All other interactive surfaces (the image / read cue) also expose `:focus-visible`.
- Tab order: read-cue → (when sheet open) source link → close button. `esc` exits the sheet from anywhere.
- The info sheet is implemented as a `<dialog>` element where supported, with `aria-labelledby` pointing at the title. Falls back to `role="dialog"` + `aria-modal="true"` otherwise.
- Keyboard shortcuts are documented in a hidden help string read on first load by screen readers: "Press down arrow or space to advance, up arrow to go back, i for info, escape to close info."
- Respects `prefers-reduced-motion` as described above.

## Testing

- **APOD adapter unit test** — fed a saved fixture of a real response, asserting normalized output matches expected shape.
- **`normalize.ts` golden test** — covers HTML stripping, dedupe by URL, sort order, 500 cap, video filtering.
- **Playwright smoke test on the built site:**
  - Page loads
  - An `<img>` is visible within 2 seconds
  - Pressing `↓` swaps the visible image
  - Pressing `i` opens the info sheet
  - Pressing `esc` closes it
- No tests for the daily cron itself — the smoke test runs in CI on every push to `main`.

## Deploy

- **Hosting:** Vercel free tier, connected to the GitHub repo. Static deployment.
- **Daily fetch:** `.github/workflows/daily-fetch.yml` runs at 12:00 UTC. Checks out, runs `npm run fetch`, commits `data/images.json` if changed, pushes to `main`. Vercel auto-deploys on push.
- **CI:** `.github/workflows/ci.yml` runs on every push: install, build, run unit tests, run Playwright smoke test against the build output.
- **Secrets:** only `NASA_API_KEY` (GitHub Actions secret, free tier from api.nasa.gov).

## Open questions (none blocking)

- Whether to add a small "powered by NASA / ESA" footnote inside the info sheet, in addition to the per-image credit. Default: no — per-image credit is sufficient attribution.
- Whether to expose a `?seed=…` URL parameter so a specific shuffle can be reproduced. Default: no for beta.
