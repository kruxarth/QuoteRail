import { test, expect } from '@playwright/test';

test('merchant login and dashboard', async ({ page }) => {
  await page.goto('/merchant/login');
  await page.getByLabel('Password').fill('test-admin-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Operations console' })).toBeVisible();
  await expect(page.getByText('Hall availability')).toBeVisible();
  await expect(page.getByText('RFQs')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Grand Hall' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Studio Hall' })).toBeVisible();
  await expect(page.getByText(/available|blocked|held|committed/i).first()).toBeVisible();
});

test('public quote page is read-only and hides merchant cost', async ({ page }) => {
  await page.goto('/quote/00000000-0000-4000-8000-000000000000');
  await expect(page.getByText(/not found/i)).toBeVisible();
  await expect(page.getByText(/margin|cost subunits|grossMargin/i)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /accept|checkout|pay/i })).toHaveCount(0);
});

test('agent page shows MCP snippet and copyable RFQ', async ({ page }) => {
  await page.goto('/agent');
  await expect(page.getByText('OpenCode remote MCP')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy demo RFQ' })).toBeVisible();
});
