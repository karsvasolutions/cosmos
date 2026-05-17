import { test, expect } from '@playwright/test';

const ONE_PX_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

test('preload <link> for the next image appears on mount', async ({ page }) => {
  await page.route(/https?:\/\/apod\.nasa\.gov\/.*/, (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: ONE_PX_PNG }),
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.waitForSelector('#viewer img.is-active');
  // Pause so the slideshow doesn't keep advancing during the assertion.
  await page.keyboard.press('p');
  await page.waitForTimeout(150);

  const preloads = await page.locator('head link[rel="preload"][as="image"]').count();
  expect(preloads).toBeGreaterThanOrEqual(1);
});

test('image for cursor+1 is fetched proactively before the user clicks', async ({ page }) => {
  // Count requests per image URL so we can assert the "next" image
  // was fetched even though the user only saw the first one.
  const requests = new Map<string, number>();
  await page.route(/https?:\/\/apod\.nasa\.gov\/.*/, async (route) => {
    const url = route.request().url();
    requests.set(url, (requests.get(url) ?? 0) + 1);
    await route.fulfill({ status: 200, contentType: 'image/png', body: ONE_PX_PNG });
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.waitForSelector('#viewer img.is-active');
  await page.keyboard.press('p');
  // Give the preload a moment to fire.
  await page.waitForTimeout(500);

  // We expect at least 2 distinct image URLs to have been requested:
  // the active slide + the preloaded "next".
  expect(requests.size).toBeGreaterThanOrEqual(2);
});
