import type { Env } from '../../worker'

export function briefingQueue(env: Env) {
  return env.JOB_ROOMS.get(env.JOB_ROOMS.idFromName(`app:${env.DEEPSPACE_APP_ID}`))
}

export function enqueueBriefing(queue: ReturnType<typeof briefingQueue>, payload: object) {
  return queue.fetch('https://internal/briefing-start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}
