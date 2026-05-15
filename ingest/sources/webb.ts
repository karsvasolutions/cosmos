import type { Image } from '../types';
import { parseEsaRss } from '../rss';

const ENDPOINT = 'https://esawebb.org/images/feed/';

export async function fetchWebb(): Promise<Image[]> {
  const res = await fetch(ENDPOINT);
  if (!res.ok) throw new Error(`Webb feed: HTTP ${res.status}`);
  const xml = await res.text();
  return parseEsaRss(xml, 'webb');
}
