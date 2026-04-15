import { expect, test } from "@playwright/test"

// Auth flows — signup and login.
// Tests use a generated throw-away email so they don't conflict with real accounts.
// NOTE: These tests require a real Supabase project with email/password auth enabled.
// Set TEST_EMAIL and TEST_PASSWORD env vars (or use the defaults below for a local test user).

const TEST_EMAIL = process.env.TEST_EMAIL || "playwright-test@campus.test"
const TEST_PASSWORD = process.env.TEST_PASSWORD || "TestPassword123!"

test.describe("Auth", () => {
  test("login page loads", async ({ page }) => {
    await page.goto("/#/auth/login")
    await expect(page.getByRole("heading", { name: /sign in|log in|welcome/i })).toBeVisible()
  })

  test("shows validation for empty login submit", async ({ page }) => {
    await page.goto("/#/auth/login")

    const submitBtn = page.getByRole("button", { name: /sign in|log in/i })
    await submitBtn.click()

    // Either a browser validation tooltip or a custom error message
    const emailInput = page.locator("input[type='email']")
    const isRequired = await emailInput.evaluate((el) => el.validity.valueMissing)
    expect(isRequired).toBe(true)
  })

  test("shows error for wrong credentials", async ({ page }) => {
    await page.goto("/#/auth/login")

    await page.locator("input[type='email']").fill("nobody@nowhere.invalid")
    await page.locator("input[type='password']").fill("WrongPassword!")
    await page.getByRole("button", { name: /sign in|log in/i }).click()

    // Expect some error feedback (toast, inline message, etc.)
    await expect(
      page.locator(".toast--error, [role='alert'], .error-message")
    ).toBeVisible({ timeout: 8000 })
  })

  test("redirects to discover after login", async ({ page }) => {
    await page.goto("/#/auth/login")

    await page.locator("input[type='email']").fill(TEST_EMAIL)
    await page.locator("input[type='password']").fill(TEST_PASSWORD)
    await page.getByRole("button", { name: /sign in|log in/i }).click()

    await page.waitForURL(/(discover|events|explore)/, { timeout: 10000 })
    expect(page.url()).toMatch(/(discover|events|explore)/)
  })
})
