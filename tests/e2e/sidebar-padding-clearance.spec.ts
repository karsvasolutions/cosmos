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

for (const { name, width, height } of [
  { name: 'mobile 375', width: 375, height: 667 },
  { name: 'tablet 900', width: 900, height: 1200 },
]) {
  test(`MEASURE: content clears close button + cluster on ${name}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await page.waitForSelector('#viewer img.is-active');
    await page.keyboard.press('i');
    await expect(page.locator('body.sidebar-open')).toHaveCount(1);
    await page.waitForTimeout(400);
    // Force a long description so the sidebar is scrollable.
    await page.evaluate(() => {
      const b = document.getElementById('sidebar-body');
      if (b) b.textContent = 'Lorem ipsum dolor sit amet. '.repeat(60);
    });

    // Scroll the sidebar to the bottom so the last element (credit) is
    // in the visible area — that's the worst case for clearance below.
    await page.evaluate(() => {
      const s = document.getElementById('info-sidebar')!;
      s.scrollTop = s.scrollHeight;
    });
    await page.waitForTimeout(100);

    const m = await page.evaluate(() => {
      const title = document.getElementById('sidebar-title')!.getBoundingClientRect();
      const credit = document.getElementById('sidebar-credit')!.getBoundingClientRect();
      const closeBtn = document.getElementById('sidebar-close')!.getBoundingClientRect();
      const cluster = document.querySelector('.ctrl-row')!.getBoundingClientRect();
      return {
        titleTop: title.top,
        creditBottom: credit.bottom,
        closeBottom: closeBtn.bottom,
        clusterTop: cluster.top,
        // Title is shown when scrolled to TOP, not bottom — so this
        // value is measured against an already-scrolled-down state and
        // expected to be off-screen. Skip the top assertion in this
        // worst-case scroll snapshot; mobile.gapAboveTitle is meaningful
        // only when scrolled to the top.
        gapBelowCredit: cluster.top - credit.bottom,
      };
    });
    console.log(`[${name}] MEASUREMENT:`, JSON.stringify(m, null, 2));

    // When scrolled to the bottom, the credit must end above the
    // control cluster (positive gap).
    expect(m.gapBelowCredit).toBeGreaterThan(0);
  });
}

// Separate top-clearance check (no scroll — title visible at top).
for (const { name, width, height } of [
  { name: 'mobile 375', width: 375, height: 667 },
  { name: 'tablet 900', width: 900, height: 1200 },
]) {
  test(`MEASURE: title clears close button at top on ${name}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await page.waitForSelector('#viewer img.is-active');
    await page.keyboard.press('i');
    await expect(page.locator('body.sidebar-open')).toHaveCount(1);
    await page.waitForTimeout(400);

    const m = await page.evaluate(() => {
      const title = document.getElementById('sidebar-title')!.getBoundingClientRect();
      const closeBtn = document.getElementById('sidebar-close')!.getBoundingClientRect();
      return { titleTop: title.top, closeBottom: closeBtn.bottom, gap: title.top - closeBtn.bottom };
    });
    console.log(`[${name}] TOP MEASUREMENT:`, JSON.stringify(m, null, 2));
    expect(m.gap).toBeGreaterThan(0);
  });
}
