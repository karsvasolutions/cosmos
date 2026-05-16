import { test, expect } from '@playwright/test';

const ONE_PX_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

test.beforeEach(async ({ page }) => {
  await page.route(/https?:\/\/apod\.nasa\.gov\/.*/, (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: ONE_PX_PNG }),
  );
});

test('clicking the image canvas closes the sidebar (does not advance)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.waitForSelector('#viewer img.is-active');

  // Capture the current image src
  const firstSrc = await page.locator('#viewer img.is-active').getAttribute('src');

  // Open the sidebar
  await page.keyboard.press('i');
  await expect(page.locator('body.sidebar-open')).toHaveCount(1);
  await page.waitForTimeout(300);

  // Click somewhere on the image canvas (viewport coords) — far right,
  // away from the sidebar (0–38.2%) and the centered control cluster.
  await page.mouse.click(1300, 450);
  await page.waitForTimeout(400);

  // Sidebar should now be closed
  await expect(page.locator('body.sidebar-open')).toHaveCount(0);

  // Image should NOT have advanced (still the same src as before the click)
  const afterSrc = await page.locator('#viewer img.is-active').getAttribute('src');
  expect(afterSrc).toBe(firstSrc);
});

test('clicking the image canvas advances when the sidebar is closed', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.waitForSelector('#viewer img.is-active');

  const firstSrc = await page.locator('#viewer img.is-active').getAttribute('src');
  await page.mouse.click(700, 450);
  await page.waitForTimeout(500);
  const afterSrc = await page.locator('#viewer img.is-active').getAttribute('src');
  expect(afterSrc).not.toBe(firstSrc);
});
