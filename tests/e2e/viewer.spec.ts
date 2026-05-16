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

test('sidebar populates on first open (before any nav)', async ({ page }) => {
  await page.goto('/');
  // Wait for the viewer to be ready.
  await expect(page.locator('#viewer img.is-active')).toHaveCount(1, { timeout: 5000 });

  // Open the sidebar immediately, without advancing.
  await page.keyboard.press('i');
  await expect(page.locator('body.sidebar-open')).toHaveCount(1);

  // Both the title and the source link must be populated.
  await expect(page.locator('#sidebar-title')).not.toBeEmpty();
  const href = await page.locator('#sidebar-link').getAttribute('href');
  expect(href).toBeTruthy();
  expect(href).toMatch(/^https?:\/\//);
});

test('viewer renders an image and responds to inputs', async ({ page }) => {
  await page.goto('/');

  // An <img> inside #viewer becomes active
  const active = page.locator('#viewer img.is-active');
  await expect(active).toHaveCount(1, { timeout: 5000 });

  // Capture current src
  const firstSrc = await active.getAttribute('src');
  expect(firstSrc).toBeTruthy();

  // Press ArrowRight -> swap (with only 2 example entries, the swap goes to the other)
  await page.keyboard.press('ArrowRight');
  // Wait briefly for cross-fade
  await page.waitForTimeout(600);

  const secondSrc = await page.locator('#viewer img.is-active').getAttribute('src');
  expect(secondSrc).not.toBe(firstSrc);

  // Press i -> sidebar opens (body gets sidebar-open class)
  await page.keyboard.press('i');
  await expect(page.locator('body.sidebar-open')).toHaveCount(1);
  await expect(page.locator('#sidebar-title')).not.toBeEmpty();

  // Press i again -> sidebar toggles closed
  await page.keyboard.press('i');
  await expect(page.locator('body.sidebar-open')).toHaveCount(0);

  // Press i to reopen, then Escape -> sidebar closes
  await page.keyboard.press('i');
  await expect(page.locator('body.sidebar-open')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('body.sidebar-open')).toHaveCount(0);
});
