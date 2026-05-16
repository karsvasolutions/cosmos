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

// Title is in the fixed header at the top of the sidebar; it must
// clear the absolutely-positioned close × button in the top-right.
for (const { name, width, height } of [
  { name: 'mobile 375', width: 375, height: 667 },
  { name: 'tablet 900', width: 900, height: 1200 },
  { name: 'desktop 1440', width: 1440, height: 900 },
]) {
  test(`title clears close button at top on ${name}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await page.waitForSelector('#viewer img.is-active');
    await page.keyboard.press('i');
    await expect(page.locator('body.sidebar-open')).toHaveCount(1);
    await page.waitForTimeout(300);

    const m = await page.evaluate(() => {
      const title = document.getElementById('sidebar-title')!.getBoundingClientRect();
      const closeBtn = document.getElementById('sidebar-close')!.getBoundingClientRect();
      return { titleTop: title.top, closeBottom: closeBtn.bottom, gap: title.top - closeBtn.bottom };
    });
    expect(m.gap).toBeGreaterThan(0);
  });
}

// The header is fixed (does not scroll); only the body+credit block
// scrolls when the description is long. Verify that.
test('header stays put while body scrolls (long description)', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/');
  await page.waitForSelector('#viewer img.is-active');
  await page.keyboard.press('i');
  await expect(page.locator('body.sidebar-open')).toHaveCount(1);
  await page.waitForTimeout(300);

  await page.evaluate(() => {
    const b = document.getElementById('sidebar-body');
    if (b) b.textContent = 'Lorem ipsum dolor sit amet. '.repeat(80);
  });

  const before = await page.locator('#sidebar-title').evaluate(
    (el) => el.getBoundingClientRect().top,
  );

  // Scroll the body region.
  await page.evaluate(() => {
    const s = document.querySelector('.sidebar-scroll') as HTMLElement;
    s.scrollTop = s.scrollHeight;
  });
  await page.waitForTimeout(100);

  const after = await page.locator('#sidebar-title').evaluate(
    (el) => el.getBoundingClientRect().top,
  );

  // Title should not have moved at all.
  expect(after).toBe(before);
});
