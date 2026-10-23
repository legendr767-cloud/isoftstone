import { expect, test } from '@playwright/test';
import { register, uniqueEmail, login, PASSWORD } from './helpers';

test.describe('visitor', () => {
  test('browses forex challenges, compares and selects one', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('forex edge');
    await page.getByRole('link', { name: 'Explore challenges' }).first().click();
    await expect(page).toHaveURL(/\/challenges/);
    await expect(page.getByRole('heading', { name: 'One-Step Forex Evaluation' }).first()).toBeVisible();
    await page.getByLabel('Model').selectOption('TWO_STEP');
    await expect(page.getByRole('heading', { name: 'Two-Step Forex Evaluation' }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'One-Step Forex Evaluation' })).toHaveCount(0);
    await page.getByRole('link', { name: 'View details' }).first().click();
    await expect(page.getByText('Available forex instruments')).toBeVisible();
    await expect(page.getByText('EUR/USD').first()).toBeVisible();
  });

  test('never shows futures offerings and keeps the profit calculator honest', async ({ page }) => {
    await page.goto('/challenges');
    await expect(page.locator('main')).not.toContainText(/futures contracts|E-?mini|\bCME\b/i);
    await page.goto('/calculator');
    await page.getByLabel('Hypothetical return (%)').fill('10');
    await expect(page.getByText(/Hypothetical illustration only/)).toBeVisible();
    await page.getByLabel('Hypothetical return (%)').fill('500');
    await expect(page.getByText('Enter a return between 0 and 100')).toBeVisible();
  });

  test('submits a contact request', async ({ page }) => {
    await page.goto('/contact');
    await page.getByLabel('Your name').fill('Visitor');
    await page.getByLabel('Email').fill(uniqueEmail('contact'));
    await page.getByLabel('Subject').fill('Question about rules');
    await page.getByLabel('How can we help?').fill('Could you explain the drawdown rules, please?');
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByText('Request received')).toBeVisible();
  });
});

test.describe('customer', () => {
  test('registers, sees the empty dashboard, buys through the simulator, and the order is confirmed by webhook', async ({ page }) => {
    await register(page);
    await expect(page.getByText('No challenge accounts yet')).toBeVisible();
    await page.goto('/challenges/one-step-forex');
    await page.getByRole('button', { name: 'Continue to checkout' }).click();
    await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Place order & pay' })).toBeDisabled(); // terms not yet accepted
    await page.getByLabel(/I accept the/).check();
    await page.getByRole('button', { name: 'Place order & pay' }).click();
    await expect(page.getByText('Test payment simulator')).toBeVisible();
    await page.getByRole('button', { name: 'Simulate success' }).click();
    await expect(page.getByText('Payment confirmed').first()).toBeVisible();
    await page.goto('/dashboard/accounts');
    await expect(page.getByText('Pending provisioning').first()).toBeVisible();
  });

  test('a failed payment can be retried', async ({ page }) => {
    await register(page);
    await page.goto('/challenges/one-step-forex');
    await page.getByRole('button', { name: 'Continue to checkout' }).click();
    await page.getByLabel(/I accept the/).check();
    await page.getByRole('button', { name: 'Place order & pay' }).click();
    await page.getByRole('button', { name: 'Simulate failure' }).click();
    await expect(page.getByText('Failed').first()).toBeVisible();
    await page.getByRole('button', { name: 'Try payment again' }).click();
    await page.getByRole('button', { name: 'Simulate success' }).click();
    await expect(page.getByText('Payment confirmed').first()).toBeVisible();
  });
});

test.describe('access control', () => {
  test('signed-out visitors are redirected away from private pages', async ({ page }) => {
    for (const path of ['/dashboard', '/dashboard/orders', '/admin']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test('a customer is kept out of admin', async ({ page }) => {
    await register(page);
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/dashboard/);
    const res = await page.request.get('/api/v1/admin/overview');
    expect(res.status()).toBe(403);
  });

  test('a customer cannot open another customer\'s order', async ({ browser }) => {
    const a = await browser.newPage(); await register(a);
    await a.goto('/challenges/one-step-forex'); await a.getByRole('button', { name: 'Continue to checkout' }).click();
    await a.getByLabel(/I accept the/).check(); await a.getByRole('button', { name: 'Place order & pay' }).click();
    await a.getByRole('button', { name: 'Simulate success' }).click();
    await expect(a).toHaveURL(/\/dashboard\/orders\/[0-9a-f-]{36}/);
    const orderUrl = a.url();
    const b = await browser.newPage(); await register(b);
    await b.goto(orderUrl);
    await expect(b.getByText('Order not found')).toBeVisible();
  });

  test('login rejects a wrong password', async ({ page }) => {
    const email = await register(page);
    await page.context().clearCookies();
    await login(page, email, 'Wrong-Passw0rd');
    await expect(page.getByRole('alert')).toContainText('Invalid email or password');
    void PASSWORD;
  });
});
