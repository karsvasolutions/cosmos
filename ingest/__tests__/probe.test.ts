import { describe, it, expect } from 'vitest';
import { getJpegDimensions, getPngDimensions, getImageDimensions } from '../probe';

describe('getJpegDimensions', () => {
  it('reads width/height from a JPEG SOF0 segment', () => {
    // Minimal handcrafted JPEG: SOI, SOF0 with H=1080 W=1920, then trailing zeros.
    const buf = new Uint8Array([
      0xff, 0xd8,             // SOI
      0xff, 0xc0,             // SOF0 marker
      0x00, 0x11,             // segment length (17, doesn't matter for us)
      0x08,                   // precision
      0x04, 0x38,             // height = 1080
      0x07, 0x80,             // width  = 1920
      0x03,                   // n components
      0, 0, 0, 0, 0, 0, 0, 0, // padding
    ]);
    expect(getJpegDimensions(buf)).toEqual({ width: 1920, height: 1080 });
  });

  it('skips an APP0 segment and finds SOF0 after it', () => {
    const buf = new Uint8Array([
      0xff, 0xd8,
      0xff, 0xe0, 0x00, 0x10, // APP0 length 16
      ...new Array(14).fill(0),
      0xff, 0xc0, 0x00, 0x11, 0x08,
      0x00, 0x96,             // height = 150
      0x00, 0xc8,             // width  = 200
      0x03,
      0, 0, 0, 0, 0, 0, 0, 0,
    ]);
    expect(getJpegDimensions(buf)).toEqual({ width: 200, height: 150 });
  });

  it('returns null when bytes are not a JPEG', () => {
    expect(getJpegDimensions(new Uint8Array([0, 0, 0, 0]))).toBeNull();
  });
});

describe('getPngDimensions', () => {
  it('reads width/height from a PNG IHDR chunk', () => {
    const buf = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // signature
      0x00, 0x00, 0x00, 0x0d,                           // IHDR length 13
      0x49, 0x48, 0x44, 0x52,                           // 'IHDR'
      0x00, 0x00, 0x07, 0x80,                           // width 1920
      0x00, 0x00, 0x04, 0x38,                           // height 1080
    ]);
    expect(getPngDimensions(buf)).toEqual({ width: 1920, height: 1080 });
  });

  it('returns null when bytes are not a PNG', () => {
    expect(getPngDimensions(new Uint8Array(24))).toBeNull();
  });
});

describe('getImageDimensions', () => {
  it('dispatches to JPEG or PNG parser based on magic bytes', () => {
    const jpeg = new Uint8Array([
      0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08,
      0x00, 0x64, 0x00, 0xc8, 0x03,
      0, 0, 0, 0, 0,
    ]);
    expect(getImageDimensions(jpeg)).toEqual({ width: 200, height: 100 });

    const png = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0xc8,
      0x00, 0x00, 0x00, 0x64,
    ]);
    expect(getImageDimensions(png)).toEqual({ width: 200, height: 100 });
  });
});
