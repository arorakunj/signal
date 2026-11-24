import { appFiles, buildCronContext, type Job, type JobContext } from 'deepspace/worker'
import { z } from 'zod'
import type { Env } from '../worker'
import { interestsSchema } from './lib/interests'
import { reportSchema, type Podcast } from './lib/briefing'
import { generatePodcast, generateReport } from './server/briefing-pipeline'

export const briefingRequest = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('report'), userId: z.string().min(1), topics: interestsSchema }),
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
    const report = await generateReport(integrations.call, payload.topics, progress)
    await records.update('briefings', payload.userId, { report: JSON.stringify(report) })
    return
  }

  const { audio, ...episode } = await generatePodcast(integrations.call, payload.report, progress)
  progress('Saving the private audio…')
  const file = await appFiles(env, { scope: 'self', userId: payload.userId }).upload(audio, {
    key: `briefings/${payload.report.id}.mp3`,
    name: 'Signal briefing.mp3',
  })
  const podcast: Podcast = {
    ...episode, reportId: payload.report.id, audioKey: file.key, audioPath: file.path,
  }
  await records.update('briefings', payload.userId, { podcast: JSON.stringify(podcast) })
}
