import { test, expect } from '@playwright/test';

/**
 * Generic smoke tests — target-agnostic by design.
 *
 * Every test navigates via a relative path ('/'), which Playwright resolves
 * against the baseURL configured in playwright.config.ts (driven by the
 * TARGET_URL environment variable). Nothing here assumes a specific app,
 * framework, or page content beyond the basics any healthy web page should
 * satisfy, so this suite can be pointed at ANY target without modification.
 */

test.describe('smoke', () => {
  test('page responds with status below 400', async ({ page }) => {
    const response = await page.goto('/');
    expect(response).not.toBeNull();
    expect(response!.status()).toBeLessThan(400);
  });

  test('page has a non-empty title', async ({ page }) => {
    await page.goto('/');
    await expect(page).not.toHaveTitle('');
  });

  test('body is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
  });

  // Dev-server tooling noise that doesn't indicate a broken page. HMR
  // WebSockets (Next.js/webpack/Vite) fail to connect through
  // host.docker.internal when the target runs in dev mode on the host.
  const IGNORED_CONSOLE_ERRORS = [
    /webpack-hmr/,
    /WebSocket connection to .*\/_next\//,
    /\[vite\] failed to connect/,
  ];

  test('no console errors on initial load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (
        message.type() === 'error' &&
        !IGNORED_CONSOLE_ERRORS.some((pattern) => pattern.test(message.text()))
      ) {
        errors.push(message.text());
      }
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(errors).toEqual([]);
  });

  test('at least one h1 or h2 heading is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });
});
