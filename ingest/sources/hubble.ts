import type { Image } from '../types';
import { parseEsaRss } from '../rss';

const ENDPOINT = 'https://esahubble.org/images/feed/';

export async function fetchHubble(): Promise<Image[]> {
  const res = await fetch(ENDPOINT);
  if (!res.ok) throw new Error(`Hubble feed: HTTP ${res.status}`);
  const xml = await res.text();
  return parseEsaRss(xml, 'hubble');
}
