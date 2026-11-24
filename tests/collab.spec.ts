/**
 * Multi-user collaboration spec — verifies two users sign in into
 * separate browser contexts and the app distinguishes them.
 *
 * `users(2)` takes any two accounts from your pool, so this spec passes on a
 * fresh app with no setup beyond having two test accounts:
 *   npx deepspace test accounts list
 *   npx deepspace test accounts create --email a@deepspace.test --name "A" --password-stdin
 *
 * Ask for accounts *by name* (`users(['Alice', 'Bob'])`) only when the
 * behaviour under test depends on which identity acts — otherwise naming them
 * couples the spec to one machine's pool.
 *
 * The `users` fixture handles sign-in caching (per-account storageState
 * persisted to `~/.deepspace/playwright-states/`), context creation, and
 * cleanup. No need to manage browser contexts manually.
 */
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'

// A machine that has never created test accounts is the normal state of a
// fresh checkout, and there `users()` throws — turning "you have no pool yet"
// into three red tests about the app, which it is not. Skip the file instead
// and say what creates the pool. The count is of accounts usable HERE: the
// pool is global per developer, but passwords live only on the machine that
// created the account.
const usableTestAccounts = loadAllTestAccounts().length
test.skip(
  usableTestAccounts < 2,
  `Needs 2 usable test accounts, found ${usableTestAccounts}. Create them with ` +
    '`npx deepspace test accounts create --email <name>@deepspace.test --name "<name>" ' +
    '--password-stdin`, or fetch existing pool accounts with `npx deepspace test accounts recover --all`.',
)

test('each browser renders its own signed-in account', async ({ users }) => {
  const [a, b] = await users(2)

  // /home is dynamic (under src/pages/(app)/), so it mounts the nav shell;
  // '/' is the static landing and has no navigation.
  await Promise.all([a.page.goto('/home'), b.page.goto('/home')])

  // Email, not name. The page renders the *session's* `name || email`, while
  // `user.name` here comes from the LOCAL account registry — and the two are
  // not the same fact: a display name is optional, and an account recovered on
  // another machine has none stored locally at all. The email is the credential
  // the context signed in with, so it is the one identity both sides agree on,
  // and asserting it proves the page is showing THIS browser's account.
  // The two accounts are distinct, so two exact matches is also the proof that
  // the contexts are not sharing one session.
  for (const user of [a, b]) {
    await expect(user.page.getByTestId('app-navigation')).toBeVisible({ timeout: 15_000 })

    // The identity chip shows `name || email`. Its text is not predictable, but
    // its presence is: something must be there once the profile has loaded.
    // (It is `hidden sm:inline` in some templates, so assert text, not
    // visibility.)
    await expect(user.page.getByTestId('nav-user-name')).toHaveText(/\S/, { timeout: 15_000 })

    await user.page.getByRole('button', { name: 'Account menu' }).click()
    await expect(user.page.getByTestId('nav-user-email')).toHaveText(user.email, {
      timeout: 15_000,
    })
  }
})

test('API status page renders loading success and error states', async ({ users }) => {
  const [user] = await users(1)
  let shouldFail = false
  let requestCount = 0

  await user.page.route('**/api/integrations', async (route) => {
    requestCount += 1
    if (shouldFail) {
      await route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Catalog unavailable' }),
      })
      return
    }

    await new Promise((resolve) => setTimeout(resolve, 100))
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { integrations: { openai: {}, wikipedia: {} } } }),
    })
  })

  await user.page.goto('/api-status')
  await expect(user.page.getByText('Loading integration catalog...')).toBeVisible()
  await expect(user.page.getByText('Integration catalog ready')).toBeVisible()
  await expect(user.page.getByText('2 integrations available.')).toBeVisible()

  shouldFail = true
  await user.page.getByRole('button', { name: 'Refresh' }).click()
  await expect(user.page.getByText('Catalog unavailable')).toBeVisible()
  await expect(user.page.getByText('Showing the last loaded catalog')).toBeVisible()
  await expect(user.page.getByText('Integration catalog ready')).toBeVisible()

  const urlAfterFailure = user.page.url()
  const requestsAfterFailure = requestCount
  await user.page.getByRole('button', { name: 'Refresh' }).click()
  await expect.poll(() => requestCount).toBeGreaterThan(requestsAfterFailure)
  expect(user.page.url()).toBe(urlAfterFailure)
})

test('API status page shows local retry after first-load API failure', async ({ users }) => {
  const [user] = await users(1)
  let requestCount = 0

  await user.page.route('**/api/integrations', async (route) => {
    requestCount += 1
    await route.fulfill({
      status: 502,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, error: 'Catalog unavailable' }),
    })
  })

  await user.page.goto('/api-status')
  await expect(user.page.getByText('Loading integration catalog...')).toBeVisible()
  await expect(user.page.getByText('Could not load API data')).toBeVisible()
  await expect(user.page.getByText('Retried 1 time automatically.')).toBeVisible()

  const retryButton = user.page.getByRole('button', { name: 'Retry' })
  await expect(retryButton).toBeVisible()

  const urlAfterFailure = user.page.url()
  const requestsAfterFailure = requestCount
  await retryButton.click()
  await expect.poll(() => requestCount).toBeGreaterThan(requestsAfterFailure)
  expect(user.page.url()).toBe(urlAfterFailure)
})

test('profiles persist after refresh and remain isolated between accounts', async ({ users }) => {
  const [first, second] = await users(2)
  const scenarios = [
    { page: first.page, topic: 'Science', privateTopic: 'Deep sea exploration' },
    { page: second.page, topic: 'Music', privateTopic: 'Jazz guitar' },
  ]

  for (const { page, topic, privateTopic } of scenarios) {
    await page.goto('/settings/interests')
    const preset = page.getByRole('button', { name: topic, exact: true })
    await expect(preset).toBeVisible()
    if (await preset.getAttribute('aria-pressed') === 'false') await preset.click()
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    const specifics = page.getByLabel(`Specific interest in ${topic}`)
    await specifics.fill(privateTopic)
    await specifics.press('Enter')
    await page.getByRole('button', { name: 'Save interests' }).click()
    await expect(page).toHaveURL(/\/settings$/)
    await expect(page.getByText('Interests saved.')).toBeVisible()
    await page.goto('/feed')
  }

  for (const { page, topic, privateTopic } of scenarios) {
    await page.reload()
    const interests = page.getByRole('list', { name: 'Your interests' })
    await expect(interests.getByText(topic, { exact: true })).toBeVisible()
    await expect(interests.getByText(privateTopic, { exact: true })).toBeVisible()
    const other = scenarios.find((scenario) => scenario.page !== page)!
    await expect(interests.getByText(other.privateTopic, { exact: true })).toHaveCount(0)
  }

  await first.page.goto('/settings/interests')
  await first.page.getByRole('button', { name: 'Continue', exact: true }).click()
  await first.page.getByRole('button', { name: 'Remove Deep sea exploration' }).click()
  await first.page.getByRole('button', { name: 'Save interests' }).click()
  await expect(first.page).toHaveURL(/\/settings$/)
  await expect(first.page.getByText('Interests saved.')).toBeVisible()
  await first.page.goto('/feed')
  const savedInterests = first.page.getByRole('list', { name: 'Your interests' })
  await expect(savedInterests.getByText('Science', { exact: true })).toBeVisible()
  await expect(savedInterests.getByText('Deep sea exploration', { exact: true })).toHaveCount(0)
})

test('signed-in readers without interests complete setup before opening the feed', async ({ users }) => {
  const [reader] = await users(1)
  const { page } = reader
  // Simulate an empty profile once so this runs again with the same test accounts.
  await page.route('**/api/actions/getInterests', (route) => route.fulfill({
    json: { success: true, data: [] },
  }), { times: 1 })

  // DeepSpace sends the browser to /home after its OAuth callbacks.
  await page.goto('/home')
  await expect(page.getByRole('heading', { name: 'Choose your interests' })).toBeVisible()
  await page.getByRole('button', { name: 'Science', exact: true }).click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Anything specific?' })).toBeVisible()
  await page.getByLabel('Specific interest in Science').fill('Planetary geology')
  await page.getByLabel('Specific interest in Science').press('Enter')

  await page.route('**/api/actions/saveInterests', (route) => route.fulfill({
    json: { success: false, error: 'Could not save your interests.' },
  }), { times: 1 })
  await page.getByRole('button', { name: 'Save interests' }).click()
  await expect(page.getByRole('alert')).toHaveText('Could not save your interests.')
  await expect(page.getByRole('heading', { name: 'Choose your interests' })).toBeVisible()

  await page.getByRole('button', { name: 'Save interests' }).click()
  await expect(page).toHaveURL(/\/feed$/)
  await expect(page.getByText('Planetary geology', { exact: true })).toBeVisible()

  await page.goto('/sign-in')
  await expect(page).toHaveURL(/\/feed$/)
  await expect(page.getByText('Planetary geology', { exact: true })).toBeVisible()

  await page.goto('/home?setup')
  await expect(page).toHaveURL(/\/feed$/)
  await expect(page.getByText('Planetary geology', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Choose your interests' })).toHaveCount(0)
})

test('the OAuth return can reach interest review using a loopback session cookie', async ({ users }) => {
  const [{ page, context }] = await users(1)
  await page.goto('/settings/interests')
  const science = page.getByRole('button', { name: 'Science', exact: true })
  await expect(science).toBeVisible()
  if (await science.getAttribute('aria-pressed') === 'false') await science.click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('button', { name: 'Save interests' }).click()
  await expect(page.getByText('Interests saved.')).toBeVisible()

  const sessionName = '__Secure-better-auth.session_token'
  const cookies = await context.cookies()
  const session = cookies.find((cookie) => cookie.name === sessionName)
  expect(session, 'Test account should have a DeepSpace session cookie').toBeDefined()
  await context.clearCookies({ name: sessionName })
  await context.addCookies([{ ...session!, name: 'signal.local-session', secure: false }])

  await page.goto('/home?auth=complete')
  await expect(page.getByRole('heading', { name: 'Review your interests' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Science', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Continue to feed' }).click()
  await expect(page).toHaveURL(/\/feed$/)
  await expect(page.getByRole('heading', { name: 'Your feed' })).toBeVisible()
})

test('top picks filter independently from the protected podcast page', async ({ users }) => {
  const [{ page }] = await users(1)
  await page.route('**/api/actions/getBriefing', (route) => route.fulfill({ json: {
    success: true,
    data: {
      report: null, podcast: null, latestPodcast: null,
      latestReport: {
        id: 'test-report', title: 'Top picks', summary: 'Music and Science', createdAt: '2026-11-23T12:00:00Z',
        sections: [
          { category: 'Music', heading: 'A jazz world tour', summary: 'New tour dates.', text: 'A jazz tour was announced.', citations: ['S1'] },
          { category: 'Science', heading: 'New lunar data', summary: 'New lunar data.', text: 'Researchers published lunar data.', citations: ['S2'] },
        ],
        sources: [
          { id: 'S1', title: 'Tour coverage', url: 'https://example.org/tour', publisher: 'example.org', publishedAt: null },
          { id: 'S2', title: 'Lunar coverage', url: 'https://example.org/moon', publisher: 'example.org', publishedAt: null },
        ],
      },
    },
  } }))
  await page.goto('/feed')
  await expect(page.getByRole('heading', { name: 'Top picks for you today' })).toBeVisible()
  const picks = page.getByRole('region', { name: 'Your briefing' })
  await expect(picks.getByRole('heading', { name: 'A jazz world tour' })).toBeVisible()
  await expect(picks.getByRole('heading', { name: 'New lunar data' })).toBeVisible()
  await picks.getByRole('button', { name: 'Music', exact: true }).click()
  await expect(picks.getByRole('heading', { name: 'A jazz world tour' })).toBeVisible()
  await expect(picks.getByRole('heading', { name: 'New lunar data' })).toHaveCount(0)
  await expect(picks.getByRole('button', { name: 'Generate podcast' })).toHaveCount(0)
  await page.getByRole('link', { name: 'Podcasts' }).click()
  await expect(page).toHaveURL(/\/podcasts$/)
  await expect(page.getByRole('heading', { name: 'Podcasts' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Generate podcast' })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Generate top picks' })).toHaveCount(0)
})

test('profile fields persist and deletion requires explicit confirmation', async ({ users }) => {
  const [{ page }] = await users(1)
  await page.goto('/settings')
  await page.getByRole('link', { name: /^Profile/ }).click()
  await expect(page).toHaveURL(/\/settings\/profile$/)
  await page.getByLabel('Display name').fill('Signal Test Editor')
  await page.getByLabel('Contact email').fill('editor@example.com')
  await page.getByRole('button', { name: 'Save profile' }).click()
  await expect(page).toHaveURL(/\/settings$/)
  await expect(page.getByText('Profile saved.')).toBeVisible()
  await page.reload()
  await expect(page.getByText('Signal Test Editor · editor@example.com')).toBeVisible()
  await page.getByRole('link', { name: /^Profile/ }).click()
  await expect(page.getByLabel('Display name')).toHaveValue('Signal Test Editor')
  await expect(page.getByLabel('Contact email')).toHaveValue('editor@example.com')
  await page.getByRole('link', { name: 'All settings' }).click()

  await page.getByRole('button', { name: 'Delete account' }).click()
  const dialog = page.getByRole('dialog', { name: 'Delete your Signal account?' })
  await expect(dialog.getByRole('button', { name: 'Permanently delete' })).toBeDisabled()
  await dialog.getByLabel('Type DELETE to confirm').fill('DELETE')
  await expect(dialog.getByRole('button', { name: 'Permanently delete' })).toBeEnabled()
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByText('Signal Test Editor · editor@example.com')).toBeVisible()
})
