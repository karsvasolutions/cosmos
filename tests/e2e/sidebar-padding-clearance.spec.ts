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

// With the centered-everywhere layout, the title sits in the middle
// of the sidebar (not at the top), so a normal short-description page
// puts the title far below the close button. Verify positive gap.
for (const { name, width, height } of [
  { name: 'mobile 375', width: 375, height: 667 },
  { name: 'tablet 900', width: 900, height: 1200 },
  { name: 'desktop 1440', width: 1440, height: 900 },
]) {
  test(`title clears close button on ${name}`, async ({ page }) => {
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

// Mobile only: the header is fixed at the top of the sidebar; only the
// body+credit region scrolls when the description is long.
test('mobile: header stays put while body scrolls', async ({ page }) => {
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
  await page.evaluate(() => {
    const s = document.querySelector('.sidebar-scroll') as HTMLElement;
    s.scrollTop = s.scrollHeight;
  });
  await page.waitForTimeout(100);
  const after = await page.locator('#sidebar-title').evaluate(
    (el) => el.getBoundingClientRect().top,
  );
  expect(after).toBe(before);
});
