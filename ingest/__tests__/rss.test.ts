import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEsaRss } from '../rss';

const xml = readFileSync(
  resolve(__dirname, 'fixtures/hubble.rss'),
  'utf8',
);

describe('parseEsaRss', () => {
  const items = parseEsaRss(xml, 'hubble');

  it('skips items with no credit', () => {
    // 3 items in fixture; 1 has no credit -> 2 valid
    expect(items).toHaveLength(2);
  });

  it('extracts the credit from the description', () => {
    expect(items[0]!.credit).toBe('NASA, ESA, Hubble Heritage Team');
    expect(items[1]!.credit).toBe('NASA, ESA');
  });

  it('extracts the highest-res image url from enclosure when JPEG/PNG', () => {
    // First item's enclosure is .tif — should fall back to the <img> in description
    expect(items[0]!.imageUrl).toBe(
      'https://cdn.esahubble.org/archives/images/large/heic2410a.jpg',
    );
    // Second item's enclosure is JPEG — use enclosure
    expect(items[1]!.imageUrl).toBe(
      'https://cdn.esahubble.org/archives/images/original/heic2409a.jpg',
    );
  });

  it('uses guid as id, prefixed by source', () => {
    expect(items[0]!.id).toBe('hubble-heic2410a');
  });

  it('parses pubDate to ISO date', () => {
    expect(items[0]!.date).toBe('2026-04-14');
  });

  it('strips HTML from descriptions', () => {
    expect(items[0]!.description).not.toMatch(/<[^>]+>/);
    expect(items[0]!.description).toContain('Pillars of Creation');
  });

  it('sets source correctly', () => {
    expect(items[0]!.source).toBe('hubble');
  });
});
