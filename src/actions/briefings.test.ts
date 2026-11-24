import { describe, expect, it, vi } from 'vitest'
import { mountainDay } from '../lib/edition'
import { getBriefing, listReportEditions } from './briefings'

vi.mock('deepspace/worker', () => ({ RECORD_NOT_FOUND: 'Record not found' }))

describe('story archive', () => {
  it('queries by the authenticated reader even when the request supplies another user', async () => {
    const query = vi.fn().mockResolvedValue({ success: true, data: { records: [] } })
    const get = vi.fn().mockResolvedValue({ success: false, error: 'Record not found' })
    const env = { JOB_ROOMS: { idFromName: vi.fn(), get: () => ({
      fetch: () => Response.json({ report: null, podcast: null }),
    }) } }
    const context = {
      env,
      userId: 'reader-a',
      params: { month: '2020-01', userId: 'reader-b' },
      tools: { query, get },
    } as unknown as Parameters<typeof listReportEditions>[0]

    await expect(listReportEditions(context)).resolves.toEqual({ success: true, data: { reports: [], podcasts: [], pending: false } })
    expect(query).toHaveBeenCalledWith('reportEditions', {
      where: { userId: 'reader-a', month: '2020-01' }, orderBy: 'edition', orderDir: 'desc', limit: 65,
    })
    expect(query).toHaveBeenCalledWith('podcastEpisodes', {
      where: { userId: 'reader-a', month: '2020-01' }, orderBy: 'publishedAt', orderDir: 'desc', limit: 100,
    })
    const edition = mountainDay()
    const createdAt = new Date().toISOString()
    const source = { id: 'S1', title: 'A source', url: 'https://example.org/', publisher: 'Example', publishedAt: null }
    const report = { id: 'r', title: 'Stories', summary: 'Summary', createdAt, sources: [source],
      sections: [{ heading: 'Story', text: 'Story text', citations: ['S1'] }] }
    const podcast = { reportId: 'r', title: 'Episode', transcript: 'Audio transcript',
      audioKey: 'briefings/episode.mp3', audioPath: '/api/files/example.mp3', sources: [source] }
    query.mockResolvedValueOnce({ success: true, data: { records: [{ data: { edition, report: JSON.stringify(report) } }] } })
      .mockResolvedValueOnce({ success: true, data: { records: [] } })
      .mockResolvedValueOnce({ success: true, data: { records: [{ data: { publishedAt: createdAt, podcast: JSON.stringify(podcast) } }] } })
    await expect(listReportEditions({ ...context, params: {} })).resolves.toMatchObject({
      success: true, data: { reports: [{ edition, report }], podcasts: [{ publishedAt: createdAt, podcast }] },
    })
    expect(get).toHaveBeenCalledWith('briefings', 'reader-a')
  })
  it('keeps a report from before the cutoff in the Feed after reloading', async () => {
    const report = {
      id: 'r', title: 'Stories', summary: 'Summary', createdAt: '2026-11-24T07:25:00Z',
      sources: [{ id: 'S1', title: 'Source', url: 'https://example.org/', publisher: 'Example', publishedAt: null }],
      sections: [{ heading: 'Story', text: 'Story text', category: 'Science', citations: ['S1'] }],
    }
    const context = {
      env: { JOB_ROOMS: { idFromName: vi.fn(), get: () => ({
        fetch: () => Response.json({ report: null, podcast: null }),
      }) } },
      userId: 'reader',
      tools: {
        get: vi.fn().mockResolvedValue({ success: false, error: 'Record not found' }),
        query: vi.fn().mockImplementation((collection) => ({
          success: true, data: { records: collection === 'reportEditions'
            ? [{ data: { edition: '2026-11-24', report: JSON.stringify(report) } }] : [] },
        })),
      },
    } as unknown as Parameters<typeof getBriefing>[0]
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-11-24T11:59:59Z'))
      await expect(getBriefing(context)).resolves.toMatchObject({ data: { todayReport: report } })
      vi.setSystemTime(new Date('2026-11-24T12:00:00Z'))
      await expect(getBriefing(context)).resolves.toMatchObject({ data: { todayReport: null, latestReport: report } })
    } finally {
      vi.useRealTimers()
    }
  })

})
