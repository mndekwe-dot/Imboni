import { test, expect } from '@playwright/test'

/**
 * Login flow — the app's front door. Exercises real routing, the auth POST,
 * token persistence, and the protected-route redirect, in a real browser.
 *
 * The backend is stubbed at the network layer, so this runs with no Django/MySQL.
 */

const USER = {
    id: 'u1', first_name: 'Aline', last_name: 'Uwimana',
    role: 'dos', email: 'dos@imboni.rw',
}

/**
 * Stub every /imboni/** call. The login endpoint returns the configured
 * status/body; everything else (the calls the dashboard fires after redirect)
 * gets a benign empty response so the page doesn't hang against a missing API.
 */
async function stubApi(page, { loginStatus = 200, loginBody } = {}) {
    await page.route('**/imboni/**', async (route) => {
        if (route.request().url().includes('/imboni/auth/login/')) {
            return route.fulfill({
                status: loginStatus,
                contentType: 'application/json',
                body: JSON.stringify(
                    loginBody ?? { access: 'fake-access', refresh: 'fake-refresh', user: USER },
                ),
            })
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    })
}

test.describe('Login', () => {
    test('valid credentials log in and land on the DOS dashboard', async ({ page }) => {
        await stubApi(page)
        await page.goto('/login/dos')

        await page.fill('input[name="email"]', 'dos@imboni.rw')
        await page.fill('input[name="password"]', 'CorrectHorse1!')
        await page.getByRole('button', { name: /Sign in to/ }).click()

        // Client-side redirect to the protected DOS route.
        await expect(page).toHaveURL(/\/dos$/)

        // Token was persisted, which is what keeps the protected route from
        // bouncing back to /login.
        const token = await page.evaluate(() => localStorage.getItem('imboni_access'))
        expect(token).toBe('fake-access')
    })

    test('invalid credentials show the server error and stay on the login page', async ({ page }) => {
        await stubApi(page, { loginStatus: 401, loginBody: { error: 'Invalid email or password.' } })
        await page.goto('/login/dos')

        await page.fill('input[name="email"]', 'dos@imboni.rw')
        await page.fill('input[name="password"]', 'wrong-password')
        await page.getByRole('button', { name: /Sign in to/ }).click()

        await expect(page.getByText('Invalid email or password.')).toBeVisible()
        await expect(page).toHaveURL(/\/login\/dos$/)
    })

    test('an unauthenticated visit to a protected route redirects to login', async ({ page }) => {
        await page.goto('/dos')
        await expect(page).toHaveURL(/\/login$/)
    })

    test('a 2FA account is prompted for a code, then lands on the dashboard', async ({ page }) => {
        // Login returns a challenge instead of tokens; the 2FA step then succeeds.
        await page.route('**/imboni/**', async (route) => {
            const url = route.request().url()
            if (url.includes('/imboni/auth/2fa/login/')) {
                return route.fulfill({
                    status: 200, contentType: 'application/json',
                    body: JSON.stringify({ access: 'fake-access', refresh: 'fake-refresh', user: USER }),
                })
            }
            if (url.includes('/imboni/auth/login/')) {
                return route.fulfill({
                    status: 200, contentType: 'application/json',
                    body: JSON.stringify({ requires_2fa: true, challenge: 'signed-challenge' }),
                })
            }
            return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
        })

        await page.goto('/login/dos')
        await page.fill('input[name="email"]', 'dos@imboni.rw')
        await page.fill('input[name="password"]', 'CorrectHorse1!')
        await page.getByRole('button', { name: /Sign in to/ }).click()

        // The code step appears — password alone did not log us in.
        const codeInput = page.locator('input[name="code"]')
        await expect(codeInput).toBeVisible()
        await expect(page).toHaveURL(/\/login\/dos$/)

        await codeInput.fill('123456')
        await page.getByRole('button', { name: /Verify and sign in/ }).click()

        await expect(page).toHaveURL(/\/dos$/)
        const token = await page.evaluate(() => localStorage.getItem('imboni_access'))
        expect(token).toBe('fake-access')
    })
})
