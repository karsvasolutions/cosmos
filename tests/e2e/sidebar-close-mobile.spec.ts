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

test('mobile: close button is visible and dismisses the sidebar', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/');
  await page.waitForSelector('#viewer img.is-active');
  await page.keyboard.press('i');
  await expect(page.locator('body.sidebar-open')).toHaveCount(1);

  const closeBtn = page.locator('#sidebar-close');
  await expect(closeBtn).toBeVisible();
  await closeBtn.click();
  await expect(page.locator('body.sidebar-open')).toHaveCount(0);
});

test('desktop: close button is also visible and dismisses the sidebar', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.waitForSelector('#viewer img.is-active');
  await page.keyboard.press('i');
  await expect(page.locator('body.sidebar-open')).toHaveCount(1);

  const closeBtn = page.locator('#sidebar-close');
  await expect(closeBtn).toBeVisible();
  await closeBtn.click();
  await expect(page.locator('body.sidebar-open')).toHaveCount(0);
});
