import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fetchHubble } from '../sources/hubble';

afterEach(() => vi.restoreAllMocks());

describe('fetchHubble', () => {
  it('returns normalized image entries from the live feed', async () => {
    const xml = readFileSync(resolve(__dirname, 'fixtures/hubble.rss'), 'utf8');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, text: async () => xml }),
    );
    const out = await fetchHubble();
    expect(out.length).toBeGreaterThan(0);
    expect(out[0]!.source).toBe('hubble');
  });
});
