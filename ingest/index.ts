import { resolve } from 'node:path';
import { fetchApod } from './sources/apod';
import { mergeAndCap, writeImages } from './write';
import type { Image } from './types';

const MAX_ENTRIES = 500;
const MIN_ENTRIES = 50;
const OUTPUT = resolve(process.cwd(), 'data/images.json');

async function safeFetch(
  name: string,
  fn: () => Promise<Image[]>,
): Promise<Image[]> {
  try {
    const items = await fn();
    console.log(`[${name}] ${items.length} entries`);
    return items;
  } catch (err) {
    console.error(`[${name}] failed:`, (err as Error).message);
    return [];
  }
}

async function main() {
  const keepOnEmpty = process.argv.includes('--keep-on-empty');
  const apiKey = process.env.NASA_API_KEY ?? '';

  const apod = await safeFetch('APOD', () =>
    fetchApod({ apiKey, maxEntries: MAX_ENTRIES }),
  );

  const merged = mergeAndCap(apod, MAX_ENTRIES);
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
