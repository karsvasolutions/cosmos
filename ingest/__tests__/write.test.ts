import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { mergeAndCap, writeImages } from '../write';
import type { Image } from '../types';

const make = (overrides: Partial<Image>): Image => ({
  id: 'x',
  source: 'apod',
  title: 'T',
  date: '2026-01-01',
  credit: 'C',
  sourceUrl: 'https://example.com/',
  imageUrl: 'https://example.com/a.jpg',
  description: 'd',
  ...overrides,
});

describe('mergeAndCap', () => {
  it('sorts by date desc and caps at limit', () => {
    const inputs = [
      make({ id: '1', date: '2026-01-01', imageUrl: 'a' }),
      make({ id: '2', date: '2026-03-01', imageUrl: 'b' }),
      make({ id: '3', date: '2026-02-01', imageUrl: 'c' }),
    ];
    const out = mergeAndCap(inputs, 2);
    expect(out.map((i) => i.id)).toEqual(['2', '3']);
  });

  it('dedupes by imageUrl, keeping first occurrence', () => {
    const inputs = [
      make({ id: '1', imageUrl: 'same' }),
      make({ id: '2', imageUrl: 'same' }),
      make({ id: '3', imageUrl: 'other' }),
    ];
    const out = mergeAndCap(inputs, 10);
    expect(out.map((i) => i.id).sort()).toEqual(['1', '3']);
  });
});

describe('writeImages', () => {
  it('writes JSON to disk', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'cosmos-'));
    const file = resolve(dir, 'images.json');
    const items = [make({ id: 'a', imageUrl: 'http://a/1.jpg' })];
    writeImages(file, items);
    const round = JSON.parse(readFileSync(file, 'utf8'));
    expect(round).toEqual(items);
  });

  it('keepOnEmpty leaves existing file in place when new list is empty', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'cosmos-'));
    const file = resolve(dir, 'images.json');
    const existing = [make({ id: 'keep', imageUrl: 'http://k/1.jpg' })];
    writeFileSync(file, JSON.stringify(existing));
    writeImages(file, [], { keepOnEmpty: true });
    const round = JSON.parse(readFileSync(file, 'utf8'));
    expect(round[0].id).toBe('keep');
  });
});
