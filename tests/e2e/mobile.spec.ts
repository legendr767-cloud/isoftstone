import { expect, test } from '@playwright/test';

test('mobile: navigation, challenges and comparison remain usable', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('navigation', { name: 'Mobile' }).getByRole('link', { name: 'Challenges' }).click();
  await expect(page).toHaveURL(/\/challenges/);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow).toBe(false); // page body must not scroll sideways
  await expect(page.getByRole('region', { name: 'Challenge rules comparison' })).toBeVisible(); // table scrolls inside its own container
});
