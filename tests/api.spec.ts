import { test, expect } from '@playwright/test'

test.describe('API tests', () => {
  test('auth proxy forwards to auth worker', async ({ request }) => {
    const res = await request.get('/api/auth/ok')
    expect(res.ok()).toBeTruthy()
  })

  test('WebSocket endpoint exists', async ({ page }) => {
    // /home is a dynamic page (under src/pages/(app)/), so mounting it boots
    // the providers and auto-connects the records WebSocket. The static
    // landing at '/' deliberately does neither — see smoke.spec.ts.
    await page.goto('/home')
    // Wait for the app to connect its WebSocket (it auto-connects on mount)
    await page.waitForSelector('[data-testid="app-navigation"]', { timeout: 15000 })
    // If the app loaded and connected, the WS endpoint works
  })
})

test('an incomplete OAuth callback returns an explicit sign-in error', async ({ request }) => {
  const response = await request.get('/api/auth/oauth-complete', { maxRedirects: 0 })
  expect(response.status()).toBe(302)
  expect(response.headers().location).toBe('/sign-in?error=oauth')
})

test('generation actions require sign-in and paid provider routes stay server-only', async ({ request }) => {
  for (const action of ['getBriefing', 'startBriefing', 'listReportEditions']) {
    const response = await request.post(`/api/actions/${action}`, { data: {} })
    expect(response.status()).toBe(401)
  }
  for (const endpoint of ['exa/search', 'anthropic/chat-completion', 'elevenlabs/generate-speech']) {
    const response = await request.post(`/api/integrations/${endpoint}`, { data: {} })
    expect(response.status()).toBe(403)
  }
})

test('profile and account deletion actions reject anonymous requests', async ({ request }) => {
  for (const action of ['getProfileDetails', 'saveProfileDetails', 'deleteSignalAccount']) {
    const response = await request.post(`/api/actions/${action}`, { data: { confirmation: 'DELETE' } })
    expect(response.status()).toBe(401)
  }
})
