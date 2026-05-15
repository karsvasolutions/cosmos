import { writeFileSync, existsSync } from 'node:fs';
import type { Image } from './types';

export function mergeAndCap(images: Image[], limit: number): Image[] {
  const seen = new Set<string>();
  const deduped: Image[] = [];
  for (const img of images) {
    if (seen.has(img.imageUrl)) continue;
    seen.add(img.imageUrl);
    deduped.push(img);
  }
  deduped.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return deduped.slice(0, limit);
}

export type WriteOptions = {
  /** If true and `images` is empty, leave the existing file untouched. */
  keepOnEmpty?: boolean;
};

export function writeImages(
  filePath: string,
  images: Image[],
  opts: WriteOptions = {},
): void {
  if (images.length === 0 && opts.keepOnEmpty && existsSync(filePath)) {
    return;
  }
  writeFileSync(filePath, JSON.stringify(images, null, 2) + '\n', 'utf8');
}
