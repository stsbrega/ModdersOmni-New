import { test, expect } from '@playwright/test';

test('design tokens resolve at runtime', async ({ page }) => {
  await page.goto('/');

  // The body background must resolve to a real dark color — not the UA
  // default of transparent (which falls back to white).
  const bgColor = await page.evaluate(() =>
    getComputedStyle(document.body).backgroundColor,
  );
  expect(bgColor).not.toBe('rgba(0, 0, 0, 0)');
  expect(bgColor).not.toBe('rgb(255, 255, 255)');

  // A probe element using var(--color-accent) for color must NOT compute to
  // rgb(0, 0, 0) — that's the initial value when the custom property is
  // undefined.
  const accentResolved = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.color = 'var(--color-accent)';
    document.body.appendChild(probe);
    const result = getComputedStyle(probe).color;
    probe.remove();
    return result;
  });
  expect(accentResolved).not.toBe('rgb(0, 0, 0)');
});
