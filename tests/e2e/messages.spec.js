import { expect, test } from "@playwright/test"

const TEST_EMAIL = process.env.TEST_EMAIL || "playwright-test@campus.test"
const TEST_PASSWORD = process.env.TEST_PASSWORD || "TestPassword123!"

async function login(page) {
  await page.goto("/#/auth/login")
  await page.locator("input[type='email']").fill(TEST_EMAIL)
  await page.locator("input[type='password']").fill(TEST_PASSWORD)
  await page.getByRole("button", { name: /sign in|log in/i }).click()
  await page.waitForURL(/(discover|events|explore)/, { timeout: 10000 })
}

test.describe("Messages", () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto("/#/messages")
  })

  test("shows messages page", async ({ page }) => {
    // Either threads list or empty state
    const content = page.locator(".messages-page, main")
    await expect(content).toBeVisible()
  })

  test("shows empty state when no threads", async ({ page }) => {
    const threadList = page.locator(".thread-item, .messages-thread")
    const emptyState = page.locator(".messages-empty, [class*='empty']")

    const hasThreads = await threadList.count() > 0
    const hasEmpty = await emptyState.isVisible({ timeout: 3000 })

    // One or the other must be present
    expect(hasThreads || hasEmpty).toBe(true)
  })
})
