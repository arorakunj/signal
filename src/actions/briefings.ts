import { RECORD_NOT_FOUND, type ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { generationKind, podcastSchema, readStored, reportSchema } from '../lib/briefing'
import { interestsSchema } from '../lib/interests'

type SavedBriefing = { report?: string; podcast?: string }

function queue(env: Env) {
  return env.JOB_ROOMS.get(env.JOB_ROOMS.idFromName(`app:${env.DEEPSPACE_APP_ID}`))
}

export const getBriefing: ActionHandler<Env> = async ({ env, tools, userId }) => {
  // Jobs write the result before marking it ready. Read status first so
  // a completion between these reads cannot pair "ready" with a stale row.
  const status = await queue(env).fetch(`https://internal/briefing-status?reader=${encodeURIComponent(userId)}`)
  if (!status.ok) return { success: false, error: 'Could not load briefing status.' }
  const saved = await tools.get<SavedBriefing>('briefings', userId)
  if (!saved.success && saved.error !== RECORD_NOT_FOUND) {
    return { success: false, error: 'Could not load your briefing.' }
  }
  const data = saved.success ? saved.data.record.data : {}
  return {
    success: true,
    data: {
      ...await status.json<object>(),
      latestReport: readStored(reportSchema, data.report),
      latestPodcast: readStored(podcastSchema, data.podcast),
    },
  }
}

export const startBriefing: ActionHandler<Env> = async ({ env, params, tools, userId }) => {
  const kind = generationKind.safeParse(params.kind)
  if (!kind.success) return { success: false, error: 'Choose a report or podcast.' }

  let payload: object
  if (kind.data === 'report') {
    const profile = await tools.get<{ interests: string }>('profiles', userId)
    const topics = profile.success ? readStored(interestsSchema, profile.data.record.data.interests) : null
    if (!topics) return { success: false, error: 'Save your interests before generating a report.' }
    const ready = await tools.create('briefings', { userId }, userId)
    if (!ready.success) return { success: false, error: 'Could not prepare your briefing.' }
    payload = { kind: kind.data, userId, topics }
  } else {
    const saved = await tools.get<SavedBriefing>('briefings', userId)
    const report = saved.success ? readStored(reportSchema, saved.data.record.data.report) : null
    if (!report || report.sections.some((section) => !section.category)) {
      return { success: false, error: 'Generate your top picks first.' }
    }
    payload = { kind: kind.data, userId, report }
  }

  const response = await queue(env).fetch('https://internal/briefing-start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return response.json<Awaited<ReturnType<ActionHandler<Env>>>>()
}
