import { test, expect } from '@playwright/test';

// A 1x1 transparent PNG, base64-encoded.
const ONE_PX_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

test.beforeEach(async ({ page }) => {
  // Intercept any image GET to apod.nasa.gov and return a tiny PNG so
  // onload always fires regardless of network state.
  await page.route(
    /https?:\/\/apod\.nasa\.gov\/.*/,
    (route) => route.fulfill({ status: 200, contentType: 'image/png', body: ONE_PX_PNG }),
  );
});

test('viewer renders an image and responds to inputs', async ({ page }) => {
  await page.goto('/');

  // An <img> inside #viewer becomes active
  const active = page.locator('#viewer img.is-active');
  await expect(active).toHaveCount(1, { timeout: 5000 });

  // Capture current src
  const firstSrc = await active.getAttribute('src');
  expect(firstSrc).toBeTruthy();

  // Press ArrowDown -> swap (with only 2 example entries, the swap goes to the other)
  await page.keyboard.press('ArrowDown');
  // Wait briefly for cross-fade
  await page.waitForTimeout(600);

  const secondSrc = await page.locator('#viewer img.is-active').getAttribute('src');
  expect(secondSrc).not.toBe(firstSrc);

  // Press i -> sheet opens
  await page.keyboard.press('i');
  await expect(page.locator('#info-sheet[open]')).toBeVisible();
  await expect(page.locator('#sheet-title')).not.toBeEmpty();

  // Press Escape -> sheet closes
  await page.keyboard.press('Escape');
  await expect(page.locator('#info-sheet[open]')).toHaveCount(0);
});
