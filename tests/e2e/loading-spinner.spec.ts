import { test, expect } from '@playwright/test';

const ONE_PX_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

test('body.is-loading toggles while a slow image fetches', async ({ page }) => {
  // Hold every image response for ~1s so the spinner state is observable.
  await page.route(/https?:\/\/apod\.nasa\.gov\/.*/, async (route) => {
    await new Promise((r) => setTimeout(r, 1000));
    await route.fulfill({ status: 200, contentType: 'image/png', body: ONE_PX_PNG });
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  // While the initial image fetch is in flight, the body should carry
  // the is-loading class. Use waitForFunction so we tolerate the few
  // milliseconds it takes for the bootstrap module to execute.
  await page.waitForFunction(() => document.body.classList.contains('is-loading'));

  // After the load completes, the class is removed.
  await page.waitForFunction(() => !document.body.classList.contains('is-loading'));
  await page.waitForSelector('#viewer img.is-active');

  // Pause the slideshow + click NEXT. Class should appear again while
  // the next image is being fetched, then disappear when it lands.
  await page.keyboard.press('p');
  await page.waitForTimeout(150);
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => document.body.classList.contains('is-loading'));
  await page.waitForFunction(() => !document.body.classList.contains('is-loading'));
});
