import { test, expect } from '@playwright/test';

const ONE_PX_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

test('back continues past the start of session history (wraps the shuffle)', async ({ page }) => {
  await page.route(/https?:\/\/apod\.nasa\.gov\/.*/, (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: ONE_PX_PNG }),
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.waitForSelector('#viewer img.is-active');
  // Pause so timers don't interfere.
  await page.keyboard.press('p');
  await page.waitForTimeout(150);

  const startSrc = await page.locator('#viewer img.is-active').getAttribute('src');

  // No forward steps taken — session history is empty. A back click
  // should now still navigate (to a different image) rather than no-op.
  await page.keyboard.press('ArrowLeft');
  await page.waitForFunction(() => !document.body.classList.contains('is-loading'));
  const afterSrc = await page.locator('#viewer img.is-active').getAttribute('src');

  expect(afterSrc).not.toBe(startSrc);
});
