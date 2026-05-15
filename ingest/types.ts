export type ImageSource = 'apod';

export type Image = {
  /** Stable id, e.g. "apod-2026-04-22" */
  id: string;
  source: ImageSource;
  /** Plain text title */
  title: string;
  /** ISO date (YYYY-MM-DD) the image was released */
  date: string;
  /** Free-form attribution string, e.g. "NASA, ESA, CSA, STScI" */
  credit: string;
  /** Canonical page on the source site */
  sourceUrl: string;
  /** Highest-resolution image variant available */
  imageUrl: string;
  /** Smaller variant for preload, when available */
  imageUrlPreview?: string;
  width?: number;
  height?: number;
  /** Plain-text description, truncated to ~600 chars at a word boundary */
  description: string;
};
