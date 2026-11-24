import { test, expect } from '@playwright/test'
import { captureConsoleErrors } from './helpers/errors'

/**
 * Smoke tests covering both page kinds this template ships:
 *   - '/'      → the static landing (top level of src/pages/): no providers,
 *                so no auth fetch and no records WebSocket on load.
 *   - '/home'  → a dynamic page (under src/pages/(app)/): the providers mount,
 *                the nav shell renders, and the records WebSocket connects.
 *
 * The "static contract" test is the guardrail for the per-page opt-out: if
 * someone moves the providers back up into _app.tsx, it fails.
 */

/** Wait for the React app shell (present on every page). */
async function waitForApp(page: import('@playwright/test').Page) {
  await page.waitForSelector('[data-testid="app-root"]', { timeout: 15000 })
}

test.describe('Smoke tests', () => {
  test('static landing loads without JS errors', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/')
    await waitForApp(page)
    await expect(page.getByTestId('static-landing')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('landing carries one title, one description, one canonical', async ({ page }) => {
    // <Seo> (src/pages/index.tsx, values from src/seo.ts) hoists these into
    // <head>. Exactly one of each: index.html ships no static description or
    // canonical, because React 19 would not dedupe against them on mount.
    await page.goto('/')
    await expect(page.getByTestId('static-landing')).toBeVisible()
    await expect(page).toHaveTitle(/\S/)
    expect(await page.locator('head meta[name="description"]').count()).toBe(1)
    expect(await page.locator('head link[rel="canonical"]').count()).toBe(1)
  })

  test('static contract: landing fires no auth request, opens no websocket', async ({ page }) => {
    const offenders: string[] = []
    page.on('request', (req) => {
      if (req.url().includes('/api/auth/')) offenders.push(req.url())
    })
    // Only the DO room route counts — vite's own HMR socket is a dev artifact.
    page.on('websocket', (ws) => {
      if (new URL(ws.url()).pathname.startsWith('/ws/')) offenders.push(`ws: ${ws.url()}`)
    })
    await page.goto('/')
    await expect(page.getByTestId('static-landing')).toBeVisible()
    await page.waitForTimeout(1500)
    expect(offenders).toEqual([])
  })

  test('dynamic app boundary mounts on /home', async ({ page }) => {
    await page.goto('/home')
    await expect(page.getByTestId('app-navigation')).toBeVisible({ timeout: 15000 })
  })

  test('sign-in button visible when logged out', async ({ page }) => {
    await page.goto('/home')
    await expect(page.getByTestId('nav-sign-in-button')).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('nav-user-name')).toHaveCount(0)
  })

  test('unknown route shows 404', async ({ page }) => {
    await page.goto('/nonexistent-page-xyz')
    await waitForApp(page)
    await expect(page.locator('text=404')).toBeVisible()
  })
})

test('landing entry points require sign-in before choosing interests', async ({ page }) => {
  for (const entry of ['Choose your interests', 'Sign in']) {
    await page.goto('/')
    await page.getByRole('link', { name: entry, exact: true }).first().click()
    await expect(page).toHaveURL(/\/sign-in$/)
    await expect(page.getByTestId('auth-overlay')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Sign in to Signal' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Choose your interests' })).toHaveCount(0)
  }

  await page.goto('/home?setup')
  await expect(page).toHaveURL(/\/sign-in$/)
  await expect(page.getByRole('button', { name: 'Save interests' })).toHaveCount(0)
})

test('signed-out visitors cannot open the feed or settings by URL', async ({ page }) => {
  for (const path of ['/home', '/feed', '/archive', '/podcasts', '/settings']) {
    await page.goto(path)
    await expect(page).toHaveURL(/\/sign-in$/)
    await expect(page.getByRole('heading', { name: 'Sign in to Signal' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Your feed' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Choose your interests' })).toHaveCount(0)
  }
})

test('profile actions reject anonymous requests', async ({ request }) => {
  for (const name of ['getInterests', 'saveInterests']) {
    const response = await request.post(`/api/actions/${name}`, { data: {} })
    expect(response.status()).toBe(401)
  }
})

test('the landing story expands, changes scenes and reverses with scroll', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  const story = page.locator('.landing-story')
  const frame = story.locator('.landing-story-frame')
  const mask = story.locator('.landing-story-mask')
  const observatory = story.locator('[data-story-scene="observatory"]')

  await expect(story).toHaveAttribute('data-motion', 'active')
  await expect(mask).toHaveCSS('clip-path', 'inset(0% 8% 12% round 32px)')
  const start = await frame.evaluate((element) => element.getBoundingClientRect().top + window.scrollY)
  await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), start + 3)
  await expect(mask).toHaveCSS('clip-path', 'inset(-0.35% 0%)')
  await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), start + 1900)
  await expect(observatory).toHaveCSS('opacity', '1')

  for (let pass = 0; pass < 3; pass++) {
    await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), start + 850)
    await expect(mask).toHaveCSS('clip-path', 'inset(-0.35% 0%)')
    await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), start - 400)
    await expect(mask).toHaveCSS('clip-path', 'inset(0% 8% 12% round 32px)')
    await expect(frame).toHaveCSS('clip-path', 'none')
    expect(await mask.evaluate((element) => {
      const top = element.getBoundingClientRect().top
      return [top - 1, top + 1, top + 20].some((y) =>
        document.elementFromPoint(10, y)?.closest('[data-story-scene]'),
      )
    })).toBe(false)
  }
  await expect(observatory).toHaveCSS('opacity', '0')
})

test('the landing story remains readable with reduced motion on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const story = page.locator('.landing-story')
  await expect(story.getByRole('heading', { name: 'Follow a question.' })).toBeVisible()
  await expect(story.getByRole('heading', { name: 'Take curiosity with you.' })).toBeVisible()
  for (const image of await story.locator('img').all()) {
    await expect.poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  }
  await expect(story.locator('.landing-story-mask')).toHaveCSS('clip-path', 'none')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
})

test('landing navigation scrolls to each section and fits narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Page sections' })
  const home = nav.getByRole('link', { name: 'Home' })
  const tryIt = nav.getByRole('link', { name: 'Try it yourself' })

  await expect(home).toHaveAttribute('aria-current', 'location')
  await expect(nav.getByRole('link', { name: 'How it works' })).toHaveCount(0)
  await tryIt.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#try-it-yourself$/)
  await expect(tryIt).toHaveAttribute('aria-current', 'location')
  await expect(page.getByRole('heading', { name: 'What you follow shapes what you get.' })).toBeInViewport()
  await home.click()
  await expect(page).toHaveURL(/#home$/)
  await expect(home).toHaveAttribute('aria-current', 'location')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320)
})

test('the pinned image fills the viewport after resizing', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  const story = page.locator('.landing-story')
  const frame = story.locator('.landing-story-frame')
  const mask = story.locator('.landing-story-mask')
  await expect(story).toHaveAttribute('data-motion', 'active')

  for (const [width, height] of [[390, 844], [844, 390], [1280, 800]]) {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
    await page.setViewportSize({ width, height })
    await expect(frame).toHaveCSS('height', `${height}px`)
    const start = await frame.evaluate((element) => element.getBoundingClientRect().top + window.scrollY)
    await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), start + height * 0.65)
    await expect(mask).toHaveCSS('clip-path', 'inset(-0.35% 0%)')
    const gutter = await page.evaluate(() => ({
      width: window.innerWidth - document.documentElement.clientWidth,
      style: getComputedStyle(document.documentElement).scrollbarWidth,
    }))
    expect(gutter).toEqual({ width: 0, style: 'none' })
    expect(await page.evaluate(() => Boolean(document.elementFromPoint(1, 0)?.closest('[data-story-scene]')))).toBe(true)
    const frameBounds = await frame.boundingBox()
    expect(frameBounds!.x).toBeCloseTo(0, 0)
    expect(Math.abs(frameBounds!.y)).toBeLessThanOrEqual(1)
    expect(frameBounds!.width).toBeCloseTo(width, 0)
    expect(frameBounds!.height).toBeCloseTo(height, 0)
    const image = frame.locator('[data-story-scene="coast"] img')
    const bounds = await image.boundingBox()
    expect(bounds!.x).toBeLessThanOrEqual(0)
    expect(bounds!.y).toBeLessThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeGreaterThanOrEqual(width)
    expect(bounds!.y + bounds!.height).toBeGreaterThanOrEqual(height)
  }
})

test('the merged section and footer work on a tall desktop viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.goto('/')
  const tryIt = page.getByRole('link', { name: 'Try it yourself' })
  await tryIt.click()
  await expect(tryIt).toHaveAttribute('aria-current', 'location')

  const section = page.getByRole('region', { name: 'What you follow shapes what you get.' })
  await expect(section.getByRole('heading', { level: 2 })).toBeInViewport()
  await expect(section.getByRole('link', { name: 'Choose your interests' })).toBeInViewport()
  const footer = page.getByRole('contentinfo')
  const copyright = footer.getByText('© 2026')
  const notice = footer.getByText(/Signal uses AI/)
  expect((await copyright.boundingBox())!.x).toBeLessThan(350)
  expect((await notice.boundingBox())!.x).toBeGreaterThan(900)
  await expect(footer.getByRole('link', { name: 'Back to top' })).toHaveCount(0)
})


test('the intro types once per document and reveals the supporting copy afterward', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  const copy = page.locator('[data-intro-copy]')
  const typing = page.locator('[data-typing="true"]')
  await expect(page.getByRole('heading', { name: 'signal.' })).toBeVisible()
  await expect(typing).toHaveCount(2)
  await expect(copy).toHaveCSS('opacity', '0')
  await expect(typing).toHaveCount(0)
  await expect(copy).toHaveCSS('opacity', '1')

  await page.getByRole('link', { name: 'Choose your interests' }).first().click()
  await expect(page).toHaveURL(/\/sign-in$/)
  await page.goBack()
  await expect(copy).toHaveCSS('opacity', '1')
  await expect(typing).toHaveCount(0)

  await page.reload()
  await expect(typing).toHaveCount(2)
  await expect(copy).toHaveCSS('opacity', '0')
})

test('reduced motion skips the intro and the hero and footer share a wordmark style', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.locator('[data-typing="true"]')).toHaveCount(0)
  await expect(page.locator('[data-intro-copy]')).toHaveCSS('opacity', '1')
  const wordmarks = await page.locator('.landing-wordmark').evaluateAll(items =>
    items.map(item => {
      const { fontFamily, fontWeight, color } = getComputedStyle(item)
      return { fontFamily, fontWeight, color }
    }),
  )
  expect(wordmarks).toHaveLength(2)
  expect(wordmarks[0]).toEqual(wordmarks[1])
})
