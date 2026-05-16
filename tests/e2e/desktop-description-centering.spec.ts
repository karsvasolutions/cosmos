import { test, expect } from '@playwright/test';

const ONE_PX_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

// The whole content block (title → credit) sits vertically centered
// in the sidebar on tablet + desktop. Mobile keeps the fixed-header
// pattern (covered in sidebar-padding-clearance.spec.ts).
for (const { name, width, height } of [
  { name: 'tablet 900', width: 900, height: 1200 },
  { name: 'desktop 1440', width: 1440, height: 900 },
]) {
  test(`sidebar content is vertically centered on ${name}`, async ({ page }) => {
    await page.route(/https?:\/\/apod\.nasa\.gov\/.*/, (route) =>
      route.fulfill({ status: 200, contentType: 'image/png', body: ONE_PX_PNG }),
    );
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await page.waitForSelector('#viewer img.is-active');
    await page.keyboard.press('i');
    await expect(page.locator('body.sidebar-open')).toHaveCount(1);
    await page.waitForTimeout(400);

    await page.evaluate(() => {
      const b = document.getElementById('sidebar-body');
      if (b) b.textContent = 'Short description.';
    });

    const m = await page.evaluate(() => {
      const sidebar = document.getElementById('info-sidebar')!.getBoundingClientRect();
      const title = document.getElementById('sidebar-title')!.getBoundingClientRect();
      const credit = document.getElementById('sidebar-credit')!.getBoundingClientRect();
      return {
        gapAbove: title.top - sidebar.top,
        gapBelow: sidebar.bottom - credit.bottom,
      };
    });
    console.log(`[${name}] CENTERING:`, JSON.stringify(m, null, 2));

    const diff = Math.abs(m.gapAbove - m.gapBelow);
    expect(diff).toBeLessThan(4);
  });
}
