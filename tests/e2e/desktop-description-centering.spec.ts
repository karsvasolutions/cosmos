import { test, expect } from '@playwright/test';

const ONE_PX_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

test('desktop: full content (title + meta + description) is vertically centered', async ({
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

  await page.evaluate(() => {
    const b = document.getElementById('sidebar-body');
    if (b) b.textContent = 'Short description.';
  });

  const m = await page.evaluate(() => {
    const sidebar = document.getElementById('info-sidebar')!.getBoundingClientRect();
    const title = document.getElementById('sidebar-title')!.getBoundingClientRect();
    const credit = document.getElementById('sidebar-credit')!.getBoundingClientRect();
    return {
      sidebarTop: sidebar.top,
      sidebarBottom: sidebar.bottom,
      titleTop: title.top,
      creditBottom: credit.bottom,
      gapAbove: title.top - sidebar.top,
      gapBelow: sidebar.bottom - credit.bottom,
    };
  });
  console.log('CENTERING:', JSON.stringify(m, null, 2));

  // The whole content block (title at the top of the group, credit at
  // the bottom) should sit centered in the sidebar — equal gaps within
  // a small tolerance.
  const diff = Math.abs(m.gapAbove - m.gapBelow);
  expect(diff).toBeLessThan(4);
});
