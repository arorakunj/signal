import { appFiles, buildCronContext, JobRoom, RECORD_NOT_FOUND, type Job, type JobContext } from 'deepspace/worker'
import type { Env } from '../../worker'
import { briefingRequest, runJob } from '../jobs'

type Run = { status: 'queued' | 'running' | 'succeeded' | 'failed'; message: string; started: number; request_key: string | null }

export class BriefingRoom extends JobRoom<Env> {
  private readonly deleting = new Set<string>()
  constructor(state: DurableObjectState, env: Env) {
    super(state, env, { authorizeRead: () => false, authorizeWrite: () => false })
    this.sql.exec(`CREATE TABLE IF NOT EXISTS signal_runs (
      id TEXT PRIMARY KEY, reader TEXT NOT NULL, kind TEXT NOT NULL,
      started INTEGER NOT NULL, status TEXT NOT NULL, message TEXT NOT NULL
    )`)
    const columns = this.sql.exec<{ name: string }>('PRAGMA table_info(signal_runs)').toArray()
    if (!columns.some(({ name }) => name === 'request_key')) {
      this.sql.exec('ALTER TABLE signal_runs ADD COLUMN request_key TEXT')
    }
    this.sql.exec('CREATE INDEX IF NOT EXISTS signal_runs_reader ON signal_runs (reader, kind, started)')
    this.sql.exec('CREATE INDEX IF NOT EXISTS signal_runs_started ON signal_runs (started)')
  }

  private latest(reader: string, kind: string): Run | null {
    const run = this.sql.exec<Run>(
      'SELECT status, message, started, request_key FROM signal_runs WHERE reader = ? AND kind = ? ORDER BY started DESC, rowid DESC LIMIT 1',
      reader, kind,
    ).toArray()[0]
    if (run && ['queued', 'running'].includes(run.status) && Date.now() - run.started > 20 * 60_000) {
      return { ...run, status: 'failed', message: 'Generation timed out. You can try again.' }
    }
    return run ?? null
  }

  private publicStatus(run: Run | null) {
    return run ? { status: run.status, message: run.message } : null
  }

  private async deleteAccount(reader: string): Promise<Response> {
    if (this.deleting.has(reader)) {
      return Response.json({ success: false, error: 'Account deletion is already in progress.' })
    }
    const pending = ['report', 'podcast'].some((kind) => {
      const run = this.latest(reader, kind)
      return run?.status === 'queued' || run?.status === 'running'
    })
    if (pending) {
      return Response.json({ success: false, error: 'Wait for your current briefing to finish, then try again.' })
    }

    this.deleting.add(reader)
    try {
      const files = appFiles(this.env, { scope: 'self', userId: reader })
      let cursor: string | undefined
      const keys: string[] = []
      do {
        const page = await files.list({ prefix: 'briefings/', cursor })
        keys.push(...page.files.map(({ key }) => key))
        cursor = page.cursor
      } while (cursor)
      for (const key of keys) await files.delete(key)

      const { records } = buildCronContext(this.env, this.env.OWNER_USER_ID, `app:${this.env.DEEPSPACE_APP_ID}`)
      for (const collection of ['briefings', 'profiles']) {
        try {
          await records.delete(collection, reader)
        } catch (error) {
          if (!(error instanceof Error) || !error.message.endsWith(RECORD_NOT_FOUND)) throw error
        }
      }

      // The SDK queue retains job payloads until expiry. Clear this reader's
      // rows now, including old jobs that carry excerpts or preferences.
      this.sql.exec('DELETE FROM jobs WHERE enqueued_by = ?', reader)
      // Retain anonymous usage counts so deletion cannot reset the app-wide cap.
      this.sql.exec("UPDATE signal_runs SET reader = '', request_key = NULL, message = '' WHERE reader = ?", reader)
      return Response.json({ success: true, data: null })
    } catch {
      return Response.json({ success: false, error: 'Could not finish deleting your Signal data. Try again.' })
    } finally {
      this.deleting.delete(reader)
    }
  }

  protected async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (request.method === 'GET' && url.pathname === '/briefing-status') {
      const reader = url.searchParams.get('reader') ?? ''
      return Response.json({
        report: this.publicStatus(this.latest(reader, 'report')),
        podcast: this.publicStatus(this.latest(reader, 'podcast')),
      })
    }
    if (request.method === 'POST' && url.pathname === '/signal-account-delete') {
      const { userId } = await request.json<{ userId?: unknown }>()
      if (typeof userId !== 'string' || !userId) return new Response(null, { status: 400 })
      return this.deleteAccount(userId)
    }
    if (request.method !== 'POST' || url.pathname !== '/briefing-start') return super.onRequest(request)
    const parsed = briefingRequest.safeParse(await request.json())
    if (!parsed.success) return Response.json({ success: false, error: 'Invalid briefing request.' }, { status: 400 })

    const payload = parsed.data
    if (this.deleting.has(payload.userId)) {
      return Response.json({ success: false, error: 'Account deletion is in progress.' })
    }
    const requestKey = payload.kind === 'report'
      ? `top-picks-v1:${JSON.stringify(payload.topics)}`
      : payload.report.id
    const now = Date.now()
    const day = Math.floor(now / 86_400_000) * 86_400_000
    this.sql.exec('DELETE FROM signal_runs WHERE started < ?', day - 86_400_000)
    const existing = this.latest(payload.userId, payload.kind)
    if (existing && (['queued', 'running'].includes(existing.status) || (existing.status === 'succeeded' && existing.started >= day && existing.request_key === requestKey))) {
      return Response.json({ success: true, data: { status: existing.status, message: existing.message } })
    }

    const count = this.sql.exec<{ count: number }>(
      'SELECT count(*) AS count FROM signal_runs WHERE reader = ? AND kind = ? AND started >= ?',
      payload.userId, payload.kind, day,
    ).one().count
    const total = this.sql.exec<{ count: number }>(
      'SELECT count(*) AS count FROM signal_runs WHERE started >= ?', day,
    ).one().count
    if (count >= 2 || total >= 20) {
      return Response.json({ success: false, error: 'The generation limit for today was reached. Try again tomorrow (UTC).' }, { status: 429 })
    }

    const job = this.enqueue(payload.kind, payload, { enqueuedBy: payload.userId, maxAttempts: 1 })
    const message = payload.kind === 'report' ? 'Top picks queued…' : 'Podcast queued…'
    this.sql.exec(
      'INSERT INTO signal_runs (id, reader, kind, started, status, message, request_key) VALUES (?, ?, ?, ?, ?, ?, ?)',
      job.id, payload.userId, payload.kind, now, 'queued', message, requestKey,
    )
    return Response.json({ success: true, data: { status: 'queued', message } })
  }

  protected async onJob(job: Job, context: JobContext) {
    const update = (status: Run['status'], message: string) => {
      this.sql.exec('UPDATE signal_runs SET status = ?, message = ? WHERE id = ?', status, message, job.id)
    }
    // Only server-reserved jobs may spend credits, even if another caller can enqueue internally.
    const reservation = this.sql.exec<{ status: string }>('SELECT status FROM signal_runs WHERE id = ?', job.id).toArray()[0]
    if (reservation?.status !== 'queued') throw new Error('Missing briefing reservation.')
    update('running', 'Preparing the briefing…')
    try {
      await runJob(job, context, this.env, (message) => update('running', message))
      update('succeeded', 'Ready.')
    } catch (error) {
      const detail = error instanceof Error ? error.message : ''
      const safe = /^(No usable coverage|No verified picks|The draft cited|Claude did not|The generated script|ElevenLabs returned)/.test(detail)
      const message = safe ? detail : /insufficient|credits/i.test(detail)
        ? 'Generation needs more DeepSpace integration credits.'
        : 'Generation failed. Try again later.'
      update('failed', message)
      throw new Error(message)
    }
  }
}
