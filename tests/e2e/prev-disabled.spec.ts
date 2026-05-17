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

test('prev button is disabled on first load (history empty)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.waitForSelector('#viewer img.is-active');
  await page.keyboard.press('p'); // pause slideshow
  await page.waitForTimeout(150);

  await expect(page.locator('#ctrl-prev')).toBeDisabled();
});

test('prev becomes enabled after going forward, disabled again after going all the way back', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.waitForSelector('#viewer img.is-active');
  await page.keyboard.press('p');
  await page.waitForTimeout(150);

  // Advance — history grows by one, prev should enable.
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => !document.body.classList.contains('is-loading'));
  await expect(page.locator('#ctrl-prev')).toBeEnabled();

  // Back — history shrinks to empty, prev should disable.
  await page.keyboard.press('ArrowLeft');
  await page.waitForFunction(() => !document.body.classList.contains('is-loading'));
  await expect(page.locator('#ctrl-prev')).toBeDisabled();
});
