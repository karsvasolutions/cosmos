import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fetchWebb } from '../sources/webb';

afterEach(() => vi.restoreAllMocks());

describe('fetchWebb', () => {
  it('returns normalized image entries from the live feed', async () => {
    const xml = readFileSync(resolve(__dirname, 'fixtures/webb.rss'), 'utf8');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, text: async () => xml }),
    );
    const out = await fetchWebb();
    expect(out).toHaveLength(1);
    expect(out[0]!.source).toBe('webb');
    expect(out[0]!.id).toBe('webb-weic2415a');
    expect(out[0]!.credit).toContain('ESA/Webb');
  });
});
