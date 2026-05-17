import { resolve } from 'node:path';
import { fetchApod } from './sources/apod';
import { probeImageWidth } from './probe';
import { mergeAndCap, writeImages } from './write';
import type { Image } from './types';

const MAX_ENTRIES = 1500;
const MIN_ENTRIES = 50;
/** Over-fetch from APOD so we still hit MAX_ENTRIES after rejecting
 *  low-resolution images. Empirical acceptance rate is ~53%, so aim
 *  for 2× the target. */
const APOD_CANDIDATES = 3000;
const MIN_WIDTH_PX = 2048;
const PROBE_CONCURRENCY = 20;
const OUTPUT = resolve(process.cwd(), 'data/images.json');

async function safeFetch(
  name: string,
  fn: () => Promise<Image[]>,
): Promise<Image[]> {
  try {
    const items = await fn();
    console.log(`[${name}] ${items.length} candidates`);
    return items;
  } catch (err) {
    console.error(`[${name}] failed:`, (err as Error).message);
    return [];
  }
}

/** Probe each candidate's image header for width; keep only those
 *  at or above MIN_WIDTH_PX. Probes run in parallel chunks. */
async function filterByMinWidth(
  candidates: Image[],
  minWidth: number,
  concurrency: number,
): Promise<Image[]> {
  console.log(`Probing ${candidates.length} candidates for image width…`);
  const accepted: Image[] = [];
  let belowThreshold = 0;
  let probeFailed = 0;

  for (let i = 0; i < candidates.length; i += concurrency) {
    const chunk = candidates.slice(i, i + concurrency);
    const probed = await Promise.all(
      chunk.map(async (img) => {
        const width = await probeImageWidth(img.imageUrl);
        return { img, width };
      }),
    );
    for (const { img, width } of probed) {
      if (width === null) {
        probeFailed++;
        continue; // can't verify → drop (we want only known-high-res)
      }
      if (width < minWidth) {
        belowThreshold++;
        continue;
      }
      accepted.push(img);
    }
  }

  console.log(
    `Width filter: ${accepted.length} accepted, ` +
      `${belowThreshold} below ${minWidth}px, ` +
      `${probeFailed} probe failures (dropped).`,
  );
  return accepted;
}

async function main() {
  const keepOnEmpty = process.argv.includes('--keep-on-empty');
  const apiKey = process.env.NASA_API_KEY ?? '';

  const apod = await safeFetch('APOD', () =>
    fetchApod({ apiKey, maxEntries: APOD_CANDIDATES }),
  );

  const highRes = await filterByMinWidth(apod, MIN_WIDTH_PX, PROBE_CONCURRENCY);

  const merged = mergeAndCap(highRes, MAX_ENTRIES);
  console.log(`Total after dedupe/cap: ${merged.length}`);

  if (merged.length < MIN_ENTRIES) {
    if (keepOnEmpty) {
      console.warn(
        `Below threshold (${merged.length} < ${MIN_ENTRIES}); keeping existing images.json`,
      );
      writeImages(OUTPUT, merged, { keepOnEmpty: true });
      return;
    }
    console.error(`FAIL: only ${merged.length} entries (min ${MIN_ENTRIES})`);
    process.exit(1);
  }

  writeImages(OUTPUT, merged);
  console.log(`Wrote ${merged.length} entries to ${OUTPUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
