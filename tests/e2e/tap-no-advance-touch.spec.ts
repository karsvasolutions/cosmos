import { test, expect } from '@playwright/test';

const ONE_PX_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

// Emulate a touch-only mobile device on Chromium: hasTouch enables
// .tap(), isMobile sets the viewport meta + (hover: none) media query.
test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});

test('touch: tapping the image does NOT advance', async ({ page }) => {
  await page.route(/https?:\/\/apod\.nasa\.gov\/.*/, (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: ONE_PX_PNG }),
  );
  await page.goto('/');
  await page.waitForSelector('#viewer img.is-active');

  const firstSrc = await page.locator('#viewer img.is-active').getAttribute('src');

  // Tap somewhere on the image canvas (well clear of the credit at
  // bottom-left and any control).
  await page.locator('#viewer').tap({ position: { x: 150, y: 200 } });
  await page.waitForTimeout(500);

  const afterSrc = await page.locator('#viewer img.is-active').getAttribute('src');
  expect(afterSrc).toBe(firstSrc);
});
