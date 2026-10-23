import { expect, test } from '@playwright/test';
import { login } from './helpers';

// Requires an administrator provisioned with ADMIN_EMAIL / ADMIN_PASSWORD (see CI workflow / README).
const adminEmail = process.env.E2E_ADMIN_EMAIL ?? 'admin@e2e.test';
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? 'E2e-Admin-Passw0rd!';

test('administrator manages challenge products and cannot publish futures', async ({ page }) => {
  await login(page, adminEmail, adminPassword);
  await expect(page).toHaveURL(/\/admin/);
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await page.getByRole('link', { name: 'Challenges' }).click();
  await page.getByRole('link', { name: 'New challenge' }).click();

  await page.locator('#e-name').fill('E-mini Futures Challenge');
  await page.getByLabel('URL slug').fill(`futures-${Date.now()}`);
  await page.getByLabel('Tagline').fill('Trade index futures');
  await page.getByLabel('Description').fill('Trade CME futures contracts with leverage.');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText(/not supported\. iSoftStone offers forex products only/)).toBeVisible();

  await page.locator('#e-name').fill('E2E Forex Evaluation');
  await page.getByLabel('URL slug').fill(`e2e-forex-${Date.now()}`);
  await page.getByLabel('Tagline').fill('A forex challenge created by the test suite');
  await page.getByLabel('Description').fill('Forex-only evaluation created during the E2E run.');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Challenge saved')).toBeVisible();
});
