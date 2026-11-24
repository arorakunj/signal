import { appFiles, buildCronContext, type Job, type JobContext } from 'deepspace/worker'
import { z } from 'zod'
import type { Env } from '../worker'
import { interestsSchema } from './lib/interests'
import { readStored, reportSchema, type Podcast } from './lib/briefing'
import { editionDay, mountainDay } from './lib/edition'
import { generatePodcast, generateReport } from './server/briefing-pipeline'

export const briefingRequest = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('report'), userId: z.string().min(1), topics: interestsSchema, edition: z.iso.date().optional() }),
  z.object({ kind: z.literal('podcast'), userId: z.string().min(1), report: reportSchema }),
])

export async function runJob(job: Job, context: JobContext, env: Env, onProgress: (message: string) => void) {
  const payload = briefingRequest.parse(job.payload)
  const { records, integrations } = buildCronContext(env, env.OWNER_USER_ID, `app:${env.DEEPSPACE_APP_ID}`)
  function progress(message: string) {
    context.signal.throwIfAborted()
    onProgress(message)
  }

  if (payload.kind === 'report') {
    const edition = payload.edition ?? editionDay()
    const userId = payload.userId
    const where = { userId, edition }
    const existing = await records.query('reportEditions', { where, limit: 5 })
    const rowSchema = z.object({ data: z.object({ report: z.string() }) })
    if (existing.some((row) => {
      const saved = rowSchema.safeParse(row)
      const report = saved.success ? readStored(reportSchema, saved.data.data.report) : null
      return report && editionDay(new Date(report.createdAt)) === edition
    })) return

    // Use the preferences saved when the queued job starts.
    const [profile] = await records.query('profiles', { where: { recordId: userId }, limit: 1 })
    const saved = z.object({ data: z.object({ interests: z.string() }) }).safeParse(profile)
    const topics = saved.success ? readStored(interestsSchema, saved.data.data.interests) : null
    if (!topics) throw new Error('Save your interests before generating a report.')
    const report = await generateReport(integrations.call, topics, progress)
    progress('Saving your daily reports…')
    await records.create('reportEditions', {
      userId, edition: editionDay(new Date(report.createdAt)), month: mountainDay(new Date(report.createdAt)).slice(0, 7),
      report: JSON.stringify(report),
    })
    return
  }

  const where = { userId: payload.userId, jobId: job.id }
  if ((await records.query('podcastEpisodes', { where, limit: 1 })).length) return
  const { audio, ...episode } = await generatePodcast(integrations.call, payload.report, progress)
  progress('Saving the private audio…')
  const file = await appFiles(env, { scope: 'self', userId: payload.userId }).upload(audio, {
    key: `briefings/episodes/${job.id}.mp3`,
    name: 'Signal briefing.mp3',
  })
  const podcast: Podcast = {
    ...episode, reportId: payload.report.id, audioKey: file.key, audioPath: file.path,
  }
  const publishedAt = new Date()
  await records.create('podcastEpisodes', {
    ...where, month: mountainDay(publishedAt).slice(0, 7),
    publishedAt: publishedAt.toISOString(), podcast: JSON.stringify(podcast),
  })
}
