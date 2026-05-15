import type { Image } from '../types';
import { cleanDescription, isValidImage } from '../normalize';

type ApodEntry = {
  date: string;
  title: string;
  explanation: string;
  url: string;
  hdurl?: string;
  media_type: string;
  copyright?: string;
};

const ENDPOINT = 'https://api.nasa.gov/planetary/apod';
const WINDOW_DAYS = 100;

export type FetchApodOptions = {
  apiKey: string;
  /** Stop once we've collected this many image entries. */
  maxEntries: number;
  /** Override "today" for testing. */
  today?: Date;
};

export async function fetchApod(opts: FetchApodOptions): Promise<Image[]> {
  if (!opts.apiKey) {
    throw new Error('APOD: missing api key (NASA_API_KEY)');
  }

  const today = opts.today ?? new Date();
  const collected: Image[] = [];
  let end = today;

  while (collected.length < opts.maxEntries) {
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - WINDOW_DAYS);

    const url = new URL(ENDPOINT);
    url.searchParams.set('api_key', opts.apiKey);
    url.searchParams.set('start_date', iso(start));
    url.searchParams.set('end_date', iso(end));

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`APOD: HTTP ${res.status}`);
    }
    const batch = (await res.json()) as ApodEntry[];

    for (const raw of batch) {
      if (raw.media_type !== 'image') continue;
      const credit = raw.copyright?.trim() ?? '';
      if (!credit) continue; // public-domain APODs without explicit credit — skip

      const img: Image = {
        id: `apod-${raw.date}`,
        source: 'apod',
        title: raw.title.trim(),
        date: raw.date,
        credit,
        sourceUrl: apodPageUrl(raw.date),
        imageUrl: raw.hdurl ?? raw.url,
        description: cleanDescription(raw.explanation ?? ''),
      };
      if (isValidImage(img)) collected.push(img);
    }

    if (batch.length === 0) break;

    // Page backwards one day before the previous start
    end = new Date(start);
    end.setUTCDate(end.getUTCDate() - 1);

    // Safety bound — don't page back more than ~3 years
    if (end < new Date(today.getTime() - 3 * 365 * 86400_000)) break;
  }

  return collected.slice(0, opts.maxEntries);
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function apodPageUrl(date: string): string {
  // APOD pages are at /apod/apYYMMDD.html
  const [y, m, day] = date.split('-');
  return `https://apod.nasa.gov/apod/ap${y.slice(2)}${m}${day}.html`;
}
