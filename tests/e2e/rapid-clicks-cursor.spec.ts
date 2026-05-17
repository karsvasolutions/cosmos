import { test, expect } from '@playwright/test';

const ONE_PX_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

test('rapid NEXT clicks during a slow load are ignored; cursor only advances on display', async ({
  page,
}) => {
  // Throttle the image route — every image request takes ~600 ms before
  // we serve the PNG. With the old buggy code, hammering ArrowRight
  // would advance the cursor on every click. With the fix, only one
  // advance lands per actual displayed frame.
  await page.route(/https?:\/\/apod\.nasa\.gov\/.*/, async (route) => {
    await new Promise((r) => setTimeout(r, 600));
    await route.fulfill({ status: 200, contentType: 'image/png', body: ONE_PX_PNG });
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  // Wait for the initial slide to be visible.
  await page.waitForSelector('#viewer img.is-active');
  // Pause the slideshow so it doesn't auto-advance during the test.
  await page.keyboard.press('p');
  await page.waitForTimeout(100);

  const startSrc = await page.locator('#viewer img.is-active').getAttribute('src');

  // Hammer ArrowRight 5 times faster than the load can complete.
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(20); // < route delay of 600ms
  }

  // Wait for the swap that DID start to finish (only the first click
  // gets through; the rest are no-ops while isLoading=true).
  await page.waitForTimeout(1200);
  const afterFwdSrc = await page.locator('#viewer img.is-active').getAttribute('src');
  expect(afterFwdSrc).not.toBe(startSrc);

  // Single BACK should take us back to startSrc.
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(1200);
  const afterBackSrc = await page.locator('#viewer img.is-active').getAttribute('src');
  expect(afterBackSrc).toBe(startSrc);
});
