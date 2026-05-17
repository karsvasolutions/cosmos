// Tiny in-house image header parser. We only need width, and only for
// JPEG and PNG (the two formats APOD ever serves). Avoids a dependency
// like image-size / probe-image-size for what is ~50 lines of code.

function readUint16BE(buf: Uint8Array, off: number): number {
  return ((buf[off]! << 8) | buf[off + 1]!) >>> 0;
}

function readUint32BE(buf: Uint8Array, off: number): number {
  return (
    ((buf[off]! << 24) |
      (buf[off + 1]! << 16) |
      (buf[off + 2]! << 8) |
      buf[off + 3]!) >>> 0
  );
}

export function getJpegDimensions(
  buf: Uint8Array,
): { width: number; height: number } | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let offset = 2;
  while (offset < buf.length - 9) {
    if (buf[offset] !== 0xff) return null;
    const marker = buf[offset + 1]!;
    offset += 2;
    // SOFx markers carry the frame dimensions. 0xC0..0xCF excluding
    // DHT (0xC4), JPG (0xC8), DAC (0xCC).
    if (
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc
    ) {
      // segment: length(2) + precision(1) + height(2) + width(2) + ...
      offset += 3; // skip length + precision
      if (offset + 4 > buf.length) return null;
      const height = readUint16BE(buf, offset);
      const width = readUint16BE(buf, offset + 2);
      return { width, height };
    }
    // Non-SOF segment — read its length and skip the whole thing.
    if (offset + 2 > buf.length) return null;
    const segLen = readUint16BE(buf, offset);
    if (segLen < 2) return null;
    offset += segLen;
  }
  return null;
}

export function getPngDimensions(
  buf: Uint8Array,
): { width: number; height: number } | null {
  if (buf.length < 24) return null;
  // Signature: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] !== 0x89 ||
    buf[1] !== 0x50 ||
    buf[2] !== 0x4e ||
    buf[3] !== 0x47
  ) {
    return null;
  }
  // IHDR chunk type at byte 12..15
  if (
    buf[12] !== 0x49 ||
    buf[13] !== 0x48 ||
    buf[14] !== 0x44 ||
    buf[15] !== 0x52
  ) {
    return null;
  }
  return {
    width: readUint32BE(buf, 16),
    height: readUint32BE(buf, 20),
  };
}

export function getImageDimensions(
  buf: Uint8Array,
): { width: number; height: number } | null {
  return getJpegDimensions(buf) ?? getPngDimensions(buf);
}

/**
 * Range-request the first ~64 KB of an image and parse its width from
 * the JPEG / PNG header. Returns null on any failure (network, parse,
 * unsupported format) so the caller can decide how to treat it.
 */
export async function probeImageWidth(url: string): Promise<number | null> {
  try {
    const res = await fetch(url, {
      headers: { Range: 'bytes=0-65535' },
    });
    // 200 = server ignored Range and sent the whole file; 206 = partial OK.
    if (!res.ok && res.status !== 206) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    return getImageDimensions(buf)?.width ?? null;
  } catch {
    return null;
  }
}
