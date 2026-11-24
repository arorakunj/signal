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
    await page.goto('/settings')
    const preset = page.getByRole('button', { name: topic, exact: true })
    await expect(preset).toBeVisible()
    if (await preset.getAttribute('aria-pressed') === 'false') await preset.click()
    await page.getByLabel('Add your own interest').fill(privateTopic)
    await page.getByLabel('Add your own interest').press('Enter')
    await page.getByRole('button', { name: 'Save interests' }).click()
    await expect(page.getByText('Interests saved.')).toBeVisible()
    await page.goto('/feed')
  }

  for (const { page, topic, privateTopic } of scenarios) {
    await page.reload()
    await expect(page.getByText(topic, { exact: true })).toBeVisible()
    await expect(page.getByText(privateTopic, { exact: true })).toBeVisible()
    const other = scenarios.find((scenario) => scenario.page !== page)!
    await expect(page.getByText(other.privateTopic, { exact: true })).toHaveCount(0)
  }

  await first.page.goto('/settings')
  await first.page.getByRole('button', { name: 'Remove Deep sea exploration' }).click()
  await first.page.getByRole('button', { name: 'Save interests' }).click()
  await expect(first.page.getByText('Interests saved.')).toBeVisible()
  await first.page.goto('/feed')
  await expect(first.page.getByText('Science', { exact: true })).toBeVisible()
  await expect(first.page.getByText('Deep sea exploration', { exact: true })).toHaveCount(0)
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
  await page.getByLabel('Add your own interest').fill('Planetary geology')
  await page.getByLabel('Add your own interest').press('Enter')

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
