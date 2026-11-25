import { test, expect } from '@playwright/test';

// The core admin journey: log in through the real form, land on the
// dashboard, then reach the Reports page and use its tab switcher.

const EMAIL = process.env.E2E_ADMIN_EMAIL || 'e2e-admin@polyattend.test';
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'E2eAdmin!2026';

async function loginAsAdmin(page) {
  await page.goto('/login');
  await page.getByPlaceholder('Email').fill(EMAIL);
  await page.getByPlaceholder('Password').fill(PASSWORD);
  await page.getByRole('button', { name: /Login/ }).first().click();
  await page.waitForURL(/\/admin/);
}

test('admin logs in and reaches the dashboard', async ({ page }) => {
  await loginAsAdmin(page);

  await expect(page).toHaveURL(/\/admin$/);
  // The admin sidebar is the clearest "we are in the admin shell" signal
  // (nav items are buttons, not links).
  await expect(page.getByRole('button', { name: /^Reports$/ }).first()).toBeVisible();
  await expect(page.getByText(/Good (Morning|Afternoon|Evening)/).first()).toBeVisible();
});

test('admin can open Reports and switch its tabs', async ({ page }) => {
  await loginAsAdmin(page);

  await page.getByRole('button', { name: /^Reports$/ }).first().click();
  await page.waitForURL(/\/admin\/reports/);

  // Same chrome as the Teacher panel: action bar + three segmented tabs.
  await expect(page.locator('.action-bar')).toContainText('Reports');
  await expect(page.locator('.ar-tab')).toHaveCount(3);
  await expect(page.locator('.ar-tab').nth(0)).toContainText('Subject');
  await expect(page.locator('.ar-tab').nth(1)).toContainText('Session');
  await expect(page.locator('.ar-tab').nth(2)).toContainText('Student');

  // Each tab carries its own info banner; switching must update it.
  await expect(page.locator('.info-banner')).toContainText('Download the full Excel report');
  await page.locator('.ar-tab').nth(1).click();
  await expect(page.locator('.info-banner')).toContainText('Download the attendance list');
  await page.locator('.ar-tab').nth(2).click();
  await expect(page.locator('.info-banner')).toContainText("Search by Student's name or ID");
});

test('department admin scope guard redirects a plain admin away', async ({ page }) => {
  // /departmentAdmin is not for the root admin — the guard must bounce it
  // rather than rendering another role's dashboard.
  await loginAsAdmin(page);
  await page.goto('/departmentAdmin');
  await expect(page).not.toHaveURL(/\/departmentAdmin$/);
});
