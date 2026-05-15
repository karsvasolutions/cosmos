import { describe, it, expect } from 'vitest';
import {
  stripHtml,
  decodeEntities,
  truncate,
  isValidImage,
} from '../normalize';
import type { Image } from '../types';

describe('stripHtml', () => {
  it('removes tags', () => {
    expect(stripHtml('<p>hello <b>world</b></p>')).toBe('hello world');
  });
  it('collapses whitespace', () => {
    expect(stripHtml('a\n\n  b\t c')).toBe('a b c');
  });
});

describe('decodeEntities', () => {
  it('decodes common entities', () => {
    expect(decodeEntities('Tom &amp; Jerry &lt;3 &quot;hi&quot;')).toBe(
      'Tom & Jerry <3 "hi"',
    );
  });
});

describe('truncate', () => {
  it('returns input unchanged if under limit', () => {
    expect(truncate('hello world', 600)).toBe('hello world');
  });
  it('truncates at a word boundary and appends ellipsis', () => {
    const long = 'word '.repeat(200); // 1000 chars
    const out = truncate(long, 600);
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(601);
    expect(out).not.toMatch(/word…$/); // boundary, not mid-word
  });
  it('falls back to hard cut when no space exists', () => {
    const out = truncate('a'.repeat(1000), 600);
    expect(out).toBe('a'.repeat(600) + '…');
  });
});

describe('isValidImage', () => {
  const base: Image = {
    id: 'apod-2026-01-01',
    source: 'apod',
    title: 'Test',
    date: '2026-01-01',
    credit: 'NASA',
    sourceUrl: 'https://apod.nasa.gov/',
    imageUrl: 'https://apod.nasa.gov/img.jpg',
    description: 'desc',
  };
  it('accepts a complete entry', () => {
    expect(isValidImage(base)).toBe(true);
  });
  it('rejects missing credit', () => {
    expect(isValidImage({ ...base, credit: '' })).toBe(false);
  });
  it('rejects missing imageUrl', () => {
    expect(isValidImage({ ...base, imageUrl: '' })).toBe(false);
  });
  it('rejects missing title', () => {
    expect(isValidImage({ ...base, title: '' })).toBe(false);
  });
});
