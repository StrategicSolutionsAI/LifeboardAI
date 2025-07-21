import { test, expect } from '@playwright/test';

test('has correct title', async ({ page }) => {
  await page.goto('/');

  // Expect the actual title of the LifeboardAI application
  await expect(page).toHaveTitle('Lifeboard.ai - Organize Your Life, Effortlessly With AI');
});

test('homepage loads successfully', async ({ page }) => {
  await page.goto('/');

  // Check that the page loads without errors
  await expect(page.locator('body')).toBeVisible();
});