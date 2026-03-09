import { test, expect } from '@playwright/test';

test('auth page loads', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.getByText('Sign in to your dashboard')).toBeVisible();
});
