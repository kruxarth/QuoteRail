import { test, expect } from '@playwright/test';

test('merchant login and dashboard', async ({ page }) => {
  await page.goto('/merchant/login');
  await page.getByLabel('Password').fill('test-admin-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Operations' })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText('Hall availability')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Enquiries' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Grand Hall' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Studio Hall' })).toBeVisible();
  await expect(page.getByText(/available|blocked|held|committed/i).first()).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Staff sign-in' })).toBeVisible();
  await page.goto('/merchant');
  await expect(page.getByRole('heading', { name: 'Staff sign-in' })).toBeVisible();
});

test('public quote page is read-only and hides merchant cost', async ({ page }) => {
  await page.goto('/quote/00000000-0000-4000-8000-000000000000');
  await expect(page.getByRole('heading', { name: /here/i })).toBeVisible();
  await expect(page.getByText(/margin|cost subunits|grossMargin/i)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /accept|checkout|pay/i })).toHaveCount(0);
});

test('agent page explains booking without a token', async ({ page }) => {
  await page.goto('/agent');
  await expect(page.getByText('No token')).toBeVisible();
  await expect(page.getByText(/ChatGPT/i).first()).toBeVisible();
  await expect(page.getByText(/localhost/i)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Copy brief' })).toHaveCount(0);
});

test('public pages register WebMCP site tools', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(/Open this house in ChatGPT/i).first()).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-webmcp', 'ready', { timeout: 15_000 });
  const names = await page.evaluate(async () => {
    const tools = await document.modelContext?.getTools?.();
    return (tools ?? []).map((tool) => tool.name);
  });
  expect(names).toEqual(
    expect.arrayContaining([
      'get_merchant_profile',
      'request_quote',
      'accept_quote',
      'create_checkout',
    ]),
  );
  expect(names).toHaveLength(9);
  const profile = await page.evaluate(async () => {
    const tools = await document.modelContext?.getTools?.();
    const tool = tools?.find((item) => item.name === 'get_merchant_profile');
    if (!tool || !document.modelContext?.executeTool) return null;
    const raw = await document.modelContext.executeTool(tool, '{}');
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  });
  expect(JSON.stringify(profile)).toMatch(/Mosaic Events/);

  await page.goto('/agent');
  await expect(page.getByText('WebMCP site tools · live in this tab')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-webmcp', 'ready');

  await page.goto('/merchant/login');
  await expect(page.locator('html')).not.toHaveAttribute('data-webmcp', 'ready');
});
