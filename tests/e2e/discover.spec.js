import { expect, test } from "@playwright/test"

// Discover feed — requires a logged-in session.
// Set TEST_EMAIL / TEST_PASSWORD env vars matching a real Supabase account.

const TEST_EMAIL = process.env.TEST_EMAIL || "playwright-test@campus.test"
const TEST_PASSWORD = process.env.TEST_PASSWORD || "TestPassword123!"

async function login(page) {
  await page.goto("/#/auth/login")
  await page.locator("input[type='email']").fill(TEST_EMAIL)
  await page.locator("input[type='password']").fill(TEST_PASSWORD)
  await page.getByRole("button", { name: /sign in|log in/i }).click()
  await page.waitForURL(/(discover|events|explore)/, { timeout: 10000 })
}

test.describe("Discover", () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto("/#/discover")
  })

  test("shows the discover page with mode switch", async ({ page }) => {
    await expect(page.locator(".discover-mode-switch")).toBeVisible()
    await expect(page.getByRole("tab", { name: /events/i })).toBeVisible()
    await expect(page.getByRole("tab", { name: /discover/i })).toBeVisible()
  })

  test("can switch between Events and Discover modes", async ({ page }) => {
    const discoverTab = page.getByRole("tab", { name: /discover/i })
    await discoverTab.click()
    await expect(discoverTab).toHaveAttribute("aria-selected", "true")

    const eventsTab = page.getByRole("tab", { name: /events/i })
    await eventsTab.click()
    await expect(eventsTab).toHaveAttribute("aria-selected", "true")
  })

  test("event card is visible or empty state is shown", async ({ page }) => {
    // Either an event card or the end-of-stack message
    const hasCard = await page.locator(".event-card, .discover-end-card").first().isVisible({ timeout: 5000 })
    expect(hasCard).toBe(true)
  })

  test("can open comments drawer", async ({ page }) => {
    const commentBtn = page.locator(".discover-side-action.comment").first()
    const isVisible = await commentBtn.isVisible({ timeout: 3000 })
    if (!isVisible) return // no event card loaded — skip

    await commentBtn.click()
    await expect(page.locator(".discover-comments-drawer, [class*='comments']")).toBeVisible()
  })
})
