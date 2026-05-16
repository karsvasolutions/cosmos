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

test('mobile: cluster is hidden when sidebar is open', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/');
  await page.waitForSelector('#viewer img.is-active');
  // Show controls + open sidebar
  await page.mouse.move(100, 300);
  await page.waitForTimeout(150);
  await page.keyboard.press('i');
  await expect(page.locator('body.sidebar-open')).toHaveCount(1);
  await page.waitForTimeout(300);

  const opacity = await page.locator('#controls').evaluate(
    (el) => getComputedStyle(el).opacity,
  );
  expect(parseFloat(opacity)).toBe(0);
});

test('desktop: cluster stays visible when sidebar is open', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.waitForSelector('#viewer img.is-active');
  await page.mouse.move(100, 300);
  await page.waitForTimeout(150);
  await page.keyboard.press('i');
  await expect(page.locator('body.sidebar-open')).toHaveCount(1);
  await page.waitForTimeout(300);

  const opacity = await page.locator('#controls').evaluate(
    (el) => getComputedStyle(el).opacity,
  );
  expect(parseFloat(opacity)).toBe(1);
});
