import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fetchApod } from '../sources/apod';

const fixturePath = resolve(__dirname, 'fixtures/apod-range.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchApod', () => {
  it('normalizes image entries and skips videos and entries without credit', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => fixture })
        .mockResolvedValue({ ok: true, json: async () => [] }),
    );

    const out = await fetchApod({ apiKey: 'test', maxEntries: 50 });

    // 3 in fixture: 1 video (skip), 1 without copyright (skip), 1 valid
    expect(out).toHaveLength(1);
    const [img] = out;
    expect(img.source).toBe('apod');
    expect(img.id).toBe('apod-2026-04-22');
    expect(img.title).toBe('Cosmic Cliffs in the Carina Nebula');
    expect(img.date).toBe('2026-04-22');
    expect(img.credit).toBe('NASA, ESA, CSA, STScI');
    expect(img.imageUrl).toBe(
      'https://apod.nasa.gov/apod/image/2604/CarinaCliffs_hd.jpg',
    );
    expect(img.sourceUrl).toBe('https://apod.nasa.gov/apod/ap260422.html');
    expect(img.description).not.toMatch(/<[^>]+>/);
  });

  it('throws if NASA_API_KEY is empty', async () => {
    await expect(fetchApod({ apiKey: '', maxEntries: 10 })).rejects.toThrow(
      /api key/i,
    );
  });
});
