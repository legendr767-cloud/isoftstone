import { expect, type Page } from '@playwright/test';

export const PASSWORD = 'E2e-Passw0rd!';
export const uniqueEmail = (p = 'e2e') => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@test.dev`;

export async function register(page: Page, email = uniqueEmail()) {
  await page.goto('/register');
  await page.getByLabel('First name').fill('Eve');
  await page.getByLabel('Last name').fill('Trader');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByLabel(/I accept the/).check();
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  return email;
}

export async function login(page: Page, email: string, password = PASSWORD) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}
