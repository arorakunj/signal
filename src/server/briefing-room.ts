import { appFiles, buildCronContext, JobRoom, RECORD_NOT_FOUND, type Job, type JobContext } from 'deepspace/worker'
import { z } from 'zod'
import { editionDay } from '../lib/edition'
import type { Env } from '../../worker'
import { briefingRequest, runJob } from '../jobs'
import { NoRecentCoverage } from './briefing-pipeline'

type Run = { status: 'queued' | 'running' | 'succeeded' | 'failed' | 'no_coverage'; message: string; started: number; request_key: string | null }

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
    const run = this.sql.exec<Run & { job_status: string | null }>(
      `SELECT r.status, r.message, r.started, r.request_key, j.status AS job_status
       FROM signal_runs r LEFT JOIN jobs j ON j.id = r.id
       WHERE r.reader = ? AND r.kind = ? ORDER BY r.started DESC, r.rowid DESC LIMIT 1`,
      reader, kind,
    ).toArray()[0]
    if (run && ['queued', 'running'].includes(run.status) && !['queued', 'running'].includes(run.job_status ?? '')) {
      return { ...run, status: 'failed', message: 'Generation was interrupted. You can try again.' }
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
    const pending = this.sql.exec(
      `SELECT r.id FROM signal_runs r JOIN jobs j ON j.id = r.id
       WHERE r.reader = ? AND j.status IN ('queued', 'running') LIMIT 1`, reader,
    ).toArray().length > 0
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
      for (const collection of ['reportEditions', 'podcastEpisodes']) {
        for (;;) {
          const rows = await records.query(collection, { where: { userId: reader }, limit: 50 })
          for (const row of rows) await records.delete(collection, z.object({ recordId: z.string() }).parse(row).recordId)
          if (rows.length < 50) break
        }
      }
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
    const edition = editionDay()
    const requestKey = payload.kind === 'report'
      ? `daily-reports-5am:${edition}`
      : payload.report.id
    const now = Date.now()
    const day = Math.floor(now / 86_400_000) * 86_400_000
    this.sql.exec('DELETE FROM signal_runs WHERE started < ?', day - 86_400_000)
    const existing = this.latest(payload.userId, payload.kind)
    if (existing && (['queued', 'running'].includes(existing.status) || (existing.status === 'succeeded' && (payload.kind === 'report' || existing.started >= day) && existing.request_key === requestKey))) {
      return Response.json({ success: true, data: { status: existing.status, message: existing.message } })
    }

    const usage = this.sql.exec<{ attempts: number; failures: number }>(
      `SELECT count(*) AS attempts, count(CASE WHEN status IN ('failed', 'no_coverage') THEN 1 END) AS failures
       FROM signal_runs WHERE reader = ? AND kind = ? AND started >= ?`,
      payload.userId, payload.kind, day,
    ).one()
    const total = this.sql.exec<{ count: number }>(
      'SELECT count(*) AS count FROM signal_runs WHERE started >= ?', day,
    ).one().count
    const readerLimit = usage.failures > 0 ? 3 : 2
    if (usage.attempts >= readerLimit || total >= 20) {
      const message = total >= 20
        ? 'Signal has reached its shared generation limit. Try again after midnight UTC.'
        : `You’ve used today’s ${payload.kind === 'report' ? 'story' : 'podcast'} generation attempts. Try again after midnight UTC.`
      return Response.json({ success: false, error: message }, { status: 429 })
    }

    const job = this.enqueue(payload.kind, payload.kind === 'report' ? { ...payload, edition } : payload, { enqueuedBy: payload.userId, maxAttempts: 1 })
    const message = payload.kind === 'report' ? 'Daily reports queued…' : 'Podcast queued…'
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
    let stage = 'Preparing the briefing…'
    update('running', stage)
    try {
      await runJob(job, context, this.env, (message) => {
        stage = message
        update('running', stage)
      })
      update('succeeded', 'Ready.')
    } catch (error) {
      if (error instanceof NoRecentCoverage) {
        update('no_coverage', error.message)
        return
      }
      const detail = error instanceof Error ? error.message : ''
      const safe = /^(No verified reports|Save your interests|The draft cited|Claude did not|The generated script|ElevenLabs returned)/.test(detail)
      const provider = /^Integration call (exa|anthropic|elevenlabs)\//.exec(detail)?.[1]
      const service = { exa: 'Exa search', anthropic: 'Claude', elevenlabs: 'ElevenLabs' }[provider ?? '']
      const needsCredits = /insufficient|credits/i.test(detail)
      let message = 'Generation failed. Try again later.'
      if (safe) message = detail
      else if (needsCredits) message = 'Generation needs more DeepSpace integration credits.'
      else if (service) message = `${service} could not complete generation. Try again later.`

      console.error('[signal] Briefing failed', {
        kind: job.type, stage, provider, needsCredits,
        validation: error instanceof z.ZodError ? error.issues.map(({ code, path }) => ({ code, path })) : undefined,
        reason: safe ? detail : undefined,
      })
      update('failed', message)
      throw new Error(message)
    }
  }
}
