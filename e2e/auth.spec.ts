import { expect, test } from '@playwright/test';

// Seeded demo account (see the seed script / README "Test accounts").
const EMAIL = 'test1@office.dev';
const PASSWORD = 'password123';

test('redirects an anonymous visitor to the login page', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText('Welcome back')).toBeVisible();
});

test('logs in with a seeded account and loads the room list', async ({ page }) => {
  await page.goto('/login');

  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();

  // Authenticated app shell renders, and rooms load from the API using the
  // session cookie set by the login response — a full UI→API→DB round trip.
  await expect(page.getByRole('link', { name: 'Meeting Rooms' })).toBeVisible();
  await expect(page.getByText('Boardroom')).toBeVisible();
  await expect(page).not.toHaveURL(/\/login/);
});
