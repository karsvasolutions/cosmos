import { XMLParser } from 'fast-xml-parser';
import type { Image, ImageSource } from './types';
import { cleanDescription, decodeEntities, isValidImage } from './normalize';

type RssItem = {
  title: string;
  link: string;
  description: string;
  pubDate?: string;
  guid?: string | { '#text': string };
  enclosure?: { '@_url': string; '@_type'?: string } | Array<{ '@_url': string; '@_type'?: string }>;
};

const parser = new XMLParser({
  ignoreAttributes: false,
  cdataPropName: '__cdata',
  trimValues: true,
  // Disable fast-xml-parser's built-in entity expansion so the billion-laughs
  // guard (default limit: 1000) doesn't fire on ESA feeds that legitimately
  // contain 1000+ &amp; / &lt; etc. references.  Entity decoding is handled
  // downstream by decodeEntities() in normalize.ts (called from extractCredit,
  // cleanDescription, and the title field assignment above).
  processEntities: false,
});

const CREDIT_RE = /credit[:\s]*([^<\n\r]+?)(?:<|$)/i;
const IMG_TAG_RE = /<img[^>]+src=["']([^"']+\.(?:jpe?g|png))["']/i;

// ESA's live feeds don't include a per-image credit in the RSS; the credit
// lives only on the per-image page. Use a sensible default per source so we
// don't drop every entry. The fixture-based tests (which DO include credit
// text in the description) still get the more specific extracted credit.
const DEFAULT_CREDIT: Record<ImageSource, string> = {
  apod: 'NASA',
  hubble: 'NASA, ESA',
  webb: 'NASA, ESA, CSA',
};

export function parseEsaRss(xml: string, source: ImageSource): Image[] {
  const doc = parser.parse(xml);
  const channel = doc?.rss?.channel;
  if (!channel) return [];

  const rawItems = Array.isArray(channel.item) ? channel.item : [channel.item].filter(Boolean);

  const out: Image[] = [];

  for (const raw of rawItems as RssItem[]) {
    const rawDescription = unwrapCdata(raw.description ?? '');
    // Real ESA feeds entity-encode HTML in <description> (e.g. &lt;p&gt;) rather
    // than CDATA-wrapping it; with processEntities:false the parser leaves
    // those literal. Decode once so the regex extractors see real HTML tags.
    const description = decodeEntities(rawDescription);

    const credit = extractCredit(description) ?? DEFAULT_CREDIT[source];
    if (!credit) continue;

    const imageUrl = extractImageUrl(raw.enclosure, description);
    if (!imageUrl) continue;

    const id = `${source}-${extractGuid(raw)}`;
    const date = isoFromPubDate(raw.pubDate);
    if (!date) continue;

    const img: Image = {
      id,
      source,
      title: decodeEntities(String(raw.title ?? '')).trim(),
      date,
      credit,
      sourceUrl: String(raw.link ?? ''),
      imageUrl,
      description: cleanDescription(description),
    };

    if (isValidImage(img)) out.push(img);
  }

  return out;
}

function unwrapCdata(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && '__cdata' in value) {
    return String((value as { __cdata: string }).__cdata);
  }
  return '';
}

function extractCredit(description: string): string | null {
  // Strip HTML tags before matching so inline tags like <strong>Credit:</strong> don't interfere
  const plain = description.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
  const match = plain.match(CREDIT_RE);
  if (!match) return null;
  return decodeEntities(match[1]!.trim()) || null;
}

function extractImageUrl(
  enclosure: RssItem['enclosure'],
  description: string,
): string | null {
  const enclosures = Array.isArray(enclosure)
    ? enclosure
    : enclosure
      ? [enclosure]
      : [];
  for (const enc of enclosures) {
    const type = enc['@_type'];
    if (type === 'image/jpeg' || type === 'image/png') {
      return enc['@_url'];
    }
  }
  const m = description.match(IMG_TAG_RE);
  return m ? m[1]! : null;
}

function extractGuid(raw: RssItem): string {
  if (!raw.guid) return raw.link.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  if (typeof raw.guid === 'string') return raw.guid;
  return raw.guid['#text'];
}

function isoFromPubDate(pubDate?: string): string | null {
  if (!pubDate) return null;
  const t = Date.parse(pubDate);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString().slice(0, 10);
}
