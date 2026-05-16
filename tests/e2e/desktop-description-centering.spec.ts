import { test, expect } from '@playwright/test';

const ONE_PX_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

test('desktop: description is vertically centered in its scroll area (short content)', async ({
  page,
}) => {
  await page.route(/https?:\/\/apod\.nasa\.gov\/.*/, (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: ONE_PX_PNG }),
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.waitForSelector('#viewer img.is-active');
  await page.keyboard.press('i');
  await expect(page.locator('body.sidebar-open')).toHaveCount(1);
  await page.waitForTimeout(400);

  // Force a short description so the inner block fits without scrolling.
  await page.evaluate(() => {
    const b = document.getElementById('sidebar-body');
    if (b) b.textContent = 'Short description.';
  });

  const m = await page.evaluate(() => {
    const scroll = document.querySelector('.sidebar-scroll') as HTMLElement;
    const inner = document.querySelector('.sidebar-scroll-inner') as HTMLElement;
    const sr = scroll.getBoundingClientRect();
    const ir = inner.getBoundingClientRect();
    return {
      scrollTop: sr.top,
      scrollBottom: sr.bottom,
      innerTop: ir.top,
      innerBottom: ir.bottom,
      gapAbove: ir.top - sr.top,
      gapBelow: sr.bottom - ir.bottom,
    };
  });
  console.log('CENTERING:', JSON.stringify(m, null, 2));

  // Auto margins should leave roughly equal gaps above and below.
  const diff = Math.abs(m.gapAbove - m.gapBelow);
  expect(diff).toBeLessThan(2);
});
