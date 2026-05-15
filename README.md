# Cosmos

Immersive, dark-theme website showing the latest high-resolution images from space.

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:4321 — the site loads from `data/images.json`. If that file
is missing, run a fetch first (see below) or copy `data/images.example.json` to
`data/images.json`.

## Fetching the image batch

```bash
export NASA_API_KEY=your_key_here   # https://api.nasa.gov
npm run fetch
```

This pulls from NASA APOD, normalizes, dedupes, sorts by date descending,
and writes the newest 500 entries to `data/images.json`. Image binaries
stay on NASA's CDN — only metadata is stored.

## Tests

```bash
npm test          # unit tests (Vitest)
npm run test:e2e  # Playwright smoke test against the built site
```

## Deploy

The site is a static Astro build. Connect the repo to Vercel (or any static
host); the build command is `npm run build` and the output directory is `dist/`.

Daily image refresh runs in GitHub Actions at 12:00 UTC
(`.github/workflows/daily-fetch.yml`). Set the `NASA_API_KEY` secret in the
repo settings. The workflow commits any change to `data/images.json` to `main`,
which triggers a Vercel redeploy.
