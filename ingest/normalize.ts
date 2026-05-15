import type { Image } from './types';

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

export function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

export function truncate(text: string, maxLen = 600): string {
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  const base = lastSpace > 0 ? cut.slice(0, lastSpace + 1) : cut;
  return base + '…';
}

// Safety cap on full APOD explanations — well above the typical 1500-char
// length, low enough that a single malformed entry can't blow up the JSON.
const DESCRIPTION_CAP = 5000;

export function cleanDescription(raw: string): string {
  return truncate(decodeEntities(stripHtml(raw)), DESCRIPTION_CAP);
}

export function isValidImage(img: Image): boolean {
  return Boolean(
    img.id &&
      img.title &&
      img.date &&
      img.credit &&
      img.sourceUrl &&
      img.imageUrl &&
      img.description,
  );
}
