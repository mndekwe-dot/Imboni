import { test, expect } from '@playwright/test'

/**
 * Smoke tests — the app boots and its public pages render, with no backend.
 * If the production bundle is broken, these fail fast before anything else.
 */

test('landing page loads', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Imboni/i)
    await expect(page.getByText(/Imboni/i).first()).toBeVisible()
})

test('a portal login page renders its form', async ({ page }) => {
    await page.goto('/login/dos')
    await expect(page.locator('input[name="email"]')).toBeVisible()
    await expect(page.locator('input[name="password"]')).toBeVisible()
    await expect(page.getByRole('button', { name: /Sign in to/ })).toBeVisible()
})

test('unknown routes render the 404 page', async ({ page }) => {
    await page.goto('/this-route-does-not-exist')
    await expect(page.getByText(/404|not found/i).first()).toBeVisible()
})
