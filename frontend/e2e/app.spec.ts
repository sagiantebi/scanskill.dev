import { test, expect } from '@playwright/test'

const jobId = 'e2e-test-job-id'

test.describe('Skill Intent Scanner UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/stats', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ completedScans: 42 }),
      })
    })
    await page.route('**/api/tags', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tags: [
            { tag: 'programming', count: 3 },
            { tag: 'shell-commands', count: 1 },
          ],
        }),
      })
    })
  })

  test('home loads and shows scan form and tags', async ({ page }) => {
    await page.goto('/')

    await expect(
      page.getByRole('link', { name: 'Skill Intent Scanner' }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Analyze an agent skill' }),
    ).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Catalog tags' })).toBeVisible()
    await expect(page.getByRole('link', { name: /programming/ })).toBeVisible()
    await expect(page.getByText('42')).toBeVisible()
    await expect(page.getByText(/completed scans in catalog/)).toBeVisible()
  })

  test('submit navigates to scan page and shows result when pipeline done', async ({
    page,
  }) => {
    await page.route('**/api/skills', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue()
        return
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          jobId,
          status: 'queued',
        }),
      })
    })

    await page.route(`**/api/skills/${jobId}*`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: jobId,
          status: 'completed',
          progress: 100,
          sourceUrl: 'https://example.com/skill.md',
          originalSkillMarkdown: '# E2E skill markdown\n\nHello from test.',
          result: {
            sanitizedText: 'sanitized',
            urls: ['https://other.example/doc'],
            normalizedUrls: ['https://other.example/doc'],
            shellCommands: [],
            injections: [],
            tags: ['programming'],
            riskLevel: 'low',
            tldr: 'E2E summary line.',
          },
        }),
      })
    })

    await page.goto('/')

    await page.locator('#content').fill(
      'Expert full stack developer with experience in React, TypeScript, and Cloudflare Workers.',
    )

    await page.getByRole('button', { name: 'Run scan' }).click()

    await expect(page).toHaveURL(new RegExp(`/scan/${jobId}`))
    await expect(
      page.getByRole('heading', { name: 'Scan progress' }),
    ).toBeVisible()
    await expect(page.getByText('completed')).toBeVisible()
    await expect(page.getByText('E2E summary line.')).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'programming' }).first(),
    ).toBeVisible()

    await expect(
      page.getByRole('heading', { name: 'Original skill (markdown)' }),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Copy' })).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'https://example.com/skill.md' }),
    ).toBeVisible()
    await expect(page.getByText('Links extracted from skill')).toBeVisible()
  })

  test('category page lists mocked skills', async ({ page }) => {
    await page.route('**/api/skills/by-tag/programming*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tag: 'programming',
          skills: [
            {
              id: jobId,
              tldr: 'Sample',
              riskLevel: 'low',
              preview: 'Preview text for e2e.',
            },
          ],
        }),
      })
    })

    await page.goto('/category/programming')

    await expect(
      page.getByRole('heading', { name: /Catalog tag:/ }),
    ).toBeVisible()
    await expect(page.getByText('Preview text for e2e.')).toBeVisible()
    await expect(page.getByRole('link', { name: /Sample/ })).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// HomePage — additional scenarios
// ---------------------------------------------------------------------------

test.describe('HomePage — edge cases', () => {
  test('submit button is disabled when text is shorter than 10 characters', async ({
    page,
  }) => {
    await page.route('**/api/stats', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '{"completedScans":0}' }),
    )
    await page.route('**/api/tags', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '{"tags":[]}' }),
    )
    await page.goto('/')

    const btn = page.getByRole('button', { name: 'Run scan' })
    await expect(btn).toBeDisabled()

    await page.locator('#content').fill('short')
    await expect(btn).toBeDisabled()
  })

  test('shows empty-tags message when no tags exist', async ({ page }) => {
    await page.route('**/api/stats', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '{"completedScans":0}' }),
    )
    await page.route('**/api/tags', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '{"tags":[]}' }),
    )
    await page.goto('/')

    await expect(page.getByText(/No tags yet/)).toBeVisible()
  })

  test('shows hint text toggle when URL field has a valid URL', async ({ page }) => {
    await page.route('**/api/stats', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '{"completedScans":0}' }),
    )
    await page.route('**/api/tags', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '{"tags":[]}' }),
    )
    await page.goto('/')

    await expect(page.getByText('At least 10 characters.')).toBeVisible()

    await page.locator('#url').fill('https://example.com/skill.md')

    await expect(
      page.getByText('Not used when a valid URL is set above.'),
    ).toBeVisible()
  })

  test('shows error alert when submit API returns non-200', async ({ page }) => {
    await page.route('**/api/stats', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '{"completedScans":0}' }),
    )
    await page.route('**/api/tags', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '{"tags":[]}' }),
    )
    await page.route('**/api/skills', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue()
        return
      }
      await route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Content too short' }),
      })
    })

    await page.goto('/')
    await page.locator('#content').fill('This is long enough text to enable the button for submit.')
    await page.getByRole('button', { name: 'Run scan' }).click()

    await expect(page.getByRole('alert')).toContainText('Content too short')
  })

  test('submit button shows Running label while pending', async ({ page }) => {
    await page.route('**/api/stats', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '{"completedScans":0}' }),
    )
    await page.route('**/api/tags', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '{"tags":[]}' }),
    )

    let resolveSubmit!: () => void
    const submitPromise = new Promise<void>((r) => { resolveSubmit = r })

    await page.route('**/api/skills', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue()
        return
      }
      await submitPromise
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, jobId, status: 'queued' }),
      })
    })

    await page.goto('/')
    await page.locator('#content').fill('Long enough skill text for the submit button.')
    await page.getByRole('button', { name: 'Run scan' }).click()

    await expect(page.getByRole('button', { name: /Running/ })).toBeVisible()

    resolveSubmit()
  })
})

// ---------------------------------------------------------------------------
// ScanPage — additional scenarios
// ---------------------------------------------------------------------------

test.describe('ScanPage — edge cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/stats', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '{"completedScans":0}' }),
    )
    await page.route('**/api/tags', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '{"tags":[]}' }),
    )
  })

  test('shows progress bar and analyzing text while scan is in progress', async ({
    page,
  }) => {
    await page.route(`**/api/skills/${jobId}*`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: jobId,
          status: 'processing',
          progress: 45,
        }),
      })
    })

    await page.goto(`/scan/${jobId}`)

    await expect(page.getByText('processing')).toBeVisible()
    await expect(page.getByText(/Analyzing skill/)).toBeVisible()
  })

  test('shows failed status badge for failed scans', async ({ page }) => {
    await page.route(`**/api/skills/${jobId}*`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: jobId,
          status: 'failed',
          progress: 50,
        }),
      })
    })

    await page.goto(`/scan/${jobId}`)

    await expect(page.getByText('failed')).toBeVisible()
  })

  test('shows error when scan returns 404', async ({ page }) => {
    await page.route(`**/api/skills/${jobId}*`, async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Not found' }),
      })
    })

    await page.goto(`/scan/${jobId}`)

    await expect(page.getByRole('alert')).toContainText('Scan not found')
  })

  test('polls and transitions from queued to completed', async ({ page }) => {
    let callCount = 0
    await page.route(`**/api/skills/${jobId}*`, async (route) => {
      callCount++
      if (callCount <= 2) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: jobId,
            status: 'processing',
            progress: 33 * callCount,
          }),
        })
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: jobId,
            status: 'completed',
            progress: 100,
            result: {
              sanitizedText: 'clean text',
              urls: [],
              normalizedUrls: [],
              shellCommands: [],
              injections: [],
              tags: ['programming'],
              riskLevel: 'low',
              tldr: 'Polling done.',
            },
          }),
        })
      }
    })

    await page.goto(`/scan/${jobId}`)

    await expect(page.getByText(/Analyzing skill/)).toBeVisible()
    await expect(page.getByText('Polling done.')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('completed')).toBeVisible()
  })

  test('shows route notice banner when navigated with URL-override state', async ({
    page,
  }) => {
    await page.route(`**/api/skills/${jobId}*`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: jobId,
          status: 'completed',
          progress: 100,
          result: {
            sanitizedText: 'text',
            urls: [],
            normalizedUrls: [],
            shellCommands: [],
            injections: [],
            tags: [],
            riskLevel: 'low',
            tldr: null,
          },
        }),
      })
    })

    await page.goto(`/scan/${jobId}`)
    await page.evaluate((id) => {
      // React Router v7 stores navigate() state in history.state.usr (see createBrowserLocation).
      window.history.replaceState(
        {
          usr: { notice: 'URL used as source; text field was ignored.' },
          key: 'e2e-route-notice',
        },
        '',
        `/scan/${id}`,
      )
    }, jobId)
    await page.reload()

    await expect(page.getByRole('status')).toContainText(
      'URL used as source; text field was ignored.',
    )
  })

  test('does not render markdown section when originalSkillMarkdown is absent', async ({
    page,
  }) => {
    await page.route(`**/api/skills/${jobId}*`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: jobId,
          status: 'completed',
          progress: 100,
          result: {
            sanitizedText: 'text',
            urls: [],
            normalizedUrls: [],
            shellCommands: [],
            injections: [],
            tags: ['programming'],
            riskLevel: 'low',
            tldr: 'No markdown here.',
          },
        }),
      })
    })

    await page.goto(`/scan/${jobId}`)

    await expect(page.getByText('No markdown here.')).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Original skill (markdown)' }),
    ).not.toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// CategoryPage — additional scenarios
// ---------------------------------------------------------------------------

test.describe('CategoryPage — edge cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/stats', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '{"completedScans":0}' }),
    )
    await page.route('**/api/tags', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '{"tags":[]}' }),
    )
  })

  test('shows error message when API fails', async ({ page }) => {
    await page.route('**/api/skills/by-tag/broken*', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal error' }),
      })
    })

    await page.goto('/category/broken')

    await expect(page.getByRole('alert')).toContainText('Could not load catalog')
  })

  test('shows empty-list message when tag has no skills', async ({ page }) => {
    await page.route('**/api/skills/by-tag/empty-tag*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ tag: 'empty-tag', skills: [] }),
      })
    })

    await page.goto('/category/empty-tag')

    await expect(page.getByText(/No catalog entries with this tag yet/)).toBeVisible()
  })
})
