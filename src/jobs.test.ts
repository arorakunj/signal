import { describe, expect, it, vi } from 'vitest'
import { appFiles, buildCronContext, type Job, type JobContext } from 'deepspace/worker'
import type { Env } from '../worker'
import { runJob } from './jobs'
import { generateReport } from './server/briefing-pipeline'

vi.mock('deepspace/worker', () => ({ appFiles: vi.fn(), buildCronContext: vi.fn() }))
vi.mock('./server/briefing-pipeline', () => ({
  generatePodcast: vi.fn().mockResolvedValue({ title: 'Episode', transcript: 'Transcript', sources: [], audio: new Blob() }),
  generateReport: vi.fn(),
}))

describe('daily edition jobs', () => {
  it('saves one private edition per reader and date, even if reprocessed', async () => {
    const report = {
      id: 'report', createdAt: '2026-11-24T13:00:00Z', title: 'Stories', summary: 'A summary',
      sources: [{ id: 'S1', title: 'Source', url: 'https://example.com', publisher: 'Example', publishedAt: null }],
      sections: [{ heading: 'Story', text: 'Story text', citations: ['S1'] }],
    }
    vi.mocked(generateReport).mockResolvedValue(report)
    const stored: Record<string, unknown>[] = []
    const query = vi.fn(async (collection: string) => collection === 'reportEditions'
      ? stored.map((data) => ({ data }))
      : [{ data: { interests: '["Science"]' } }])
    const create = vi.fn(async (_collection: string, data: Record<string, unknown>) => stored.push(data))
    vi.mocked(buildCronContext).mockReturnValue({
      ownerUserId: 'owner',
      records: { query, create, update: vi.fn(), delete: vi.fn() },
      integrations: { call: vi.fn() },
    })
    const job = {
      payload: { kind: 'report', userId: 'reader', topics: ['Science'], edition: '2026-11-24' },
    } as Job
    const context = { signal: new AbortController().signal } as JobContext
    const env = { DEEPSPACE_APP_ID: 'app', OWNER_USER_ID: 'owner' } as Env

    await runJob(job, context, env, vi.fn())
    await runJob(job, context, env, vi.fn())
    expect(query).toHaveBeenCalledWith('profiles', { where: { recordId: 'reader' }, limit: 1 })
    expect(create).toHaveBeenCalledExactlyOnceWith('reportEditions', {
      userId: 'reader', edition: '2026-11-24', month: '2026-11', report: JSON.stringify(report),
    })
  })
  it('keeps separate private audio and metadata for each episode from the same report', async () => {
    const saved: Record<string, unknown>[] = []
    const query = vi.fn(async (_collection: string, options?: { where?: Record<string, unknown> }) =>
      saved.filter((entry) => entry.jobId === options?.where?.jobId))
    const create = vi.fn(async (_collection: string, data: Record<string, unknown>) => saved.push(data))
    vi.mocked(buildCronContext).mockReturnValue({
      ownerUserId: 'owner',
      records: { query, create, update: vi.fn(), delete: vi.fn() },
      integrations: { call: vi.fn() },
    })
    const upload = vi.fn(async (_audio: Blob, { key }: { key: string }) => ({ key, path: `/api/files/${key}` }))
    vi.mocked(appFiles).mockReturnValue({ upload } as unknown as ReturnType<typeof appFiles>)
    const context = { signal: new AbortController().signal } as JobContext
    const env = { DEEPSPACE_APP_ID: 'app', OWNER_USER_ID: 'owner' } as Env
    const report = {
      id: 'report', createdAt: '2026-11-24T12:00:00Z', title: 'Stories', summary: 'A summary',
      sources: [{ id: 'S1', title: 'Source', url: 'https://example.com', publisher: 'Example', publishedAt: null }],
      sections: [{ heading: 'Story', text: 'Story text', citations: ['S1'] }],
    }
    for (const id of ['first', 'second', 'second']) {
      await runJob({ id, payload: { kind: 'podcast', userId: 'reader', report } } as Job, context, env, vi.fn())
    }
    expect(appFiles).toHaveBeenCalledWith(env, { scope: 'self', userId: 'reader' })
    expect(saved.map(({ jobId }) => jobId)).toEqual(['first', 'second'])
    expect(upload.mock.calls.map(([, { key }]) => key)).toEqual([
      'briefings/episodes/first.mp3', 'briefings/episodes/second.mp3',
    ])
  })

})
