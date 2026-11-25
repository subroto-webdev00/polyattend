import { test, expect } from '@playwright/test';

// Unauthenticated smoke: the login portal itself must render correctly.

test('login page shows portal branding and the form', async ({ page }) => {
  await page.goto('/login');

  await expect(page.getByText('Thakurgaon Polytechnic Institute').first()).toBeVisible();
  await expect(page.getByText('LOGIN PORTAL').first()).toBeVisible();
  await expect(page.getByPlaceholder('Email')).toBeVisible();
  await expect(page.getByPlaceholder('Password')).toBeVisible();
  await expect(page.getByRole('button', { name: /Login/ }).first()).toBeVisible();
});

test('a wrong password is rejected with a visible error', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('Email').fill('e2e-admin@polyattend.test');
  await page.getByPlaceholder('Password').fill('definitely-wrong-1');
  await page.getByRole('button', { name: /Login/ }).first().click();

  // The app must stay on /login and explain the failure.
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText(/Invalid email or password/)).toBeVisible();
});
