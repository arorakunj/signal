import { RECORD_NOT_FOUND, type ActionHandler } from 'deepspace/worker'
import { z } from 'zod'
import type { Env } from '../../worker'
import { generationKind, podcastSchema, progressSchema, readStored, reportSchema, type Podcast, type Report } from '../lib/briefing'
import { editionDay, mountainDay } from '../lib/edition'
import { interestsSchema } from '../lib/interests'
import { briefingQueue, enqueueBriefing } from '../server/briefing-queue'

type SavedBriefing = { report?: string; podcast?: string }
type SavedEpisode = { publishedAt: string; podcast: string }
type SavedEdition = { edition: string; report: string }
type Tools = Parameters<ActionHandler<Env>>[0]['tools']

async function loadBriefing(tools: Tools, userId: string) {
  const [saved, editions, episodes] = await Promise.all([
    tools.get<SavedBriefing>('briefings', userId),
    tools.query<SavedEdition>('reportEditions', { where: { userId }, orderBy: 'createdAt', orderDir: 'desc', limit: 1 }),
    tools.query<SavedEpisode>('podcastEpisodes', { where: { userId }, orderBy: 'publishedAt', orderDir: 'desc', limit: 1 }),
  ])
  if ((!saved.success && saved.error !== RECORD_NOT_FOUND) || !editions.success || !episodes.success) return null
  const snapshot = saved.success ? saved.data.record.data : {}
  const newest = editions.data.records[0]?.data
  const legacy = readStored(reportSchema, snapshot.report)
  const latest = readStored(reportSchema, newest?.report) ?? legacy
  const edition = latest ? editionDay(new Date(latest.createdAt)) : null
  return {
    latestReport: latest,
    todayReport: edition === editionDay() ? latest : null,
    latestPodcast: readStored(podcastSchema, episodes.data.records[0]?.data.podcast) ?? readStored(podcastSchema, snapshot.podcast),
  }
}

export const getBriefing: ActionHandler<Env> = async ({ env, tools, userId }) => {
  // Read status first since jobs write the result before marking it ready.
  const status = await briefingQueue(env).fetch(`https://internal/briefing-status?reader=${encodeURIComponent(userId)}`)
  if (!status.ok) return { success: false, error: 'Could not load briefing status.' }
  const data = await loadBriefing(tools, userId)
  if (!data) return { success: false, error: 'Could not load your briefing.' }
  return { success: true, data: { ...await status.json<object>(), ...data } }
}

export const listReportEditions: ActionHandler<Env> = async ({ env, tools, userId, params }) => {
  const today = mountainDay()
  const month = params.month ?? today.slice(0, 7)
  if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month > today.slice(0, 7)) {
    return { success: false, error: 'Choose a valid archive month.' }
  }
  // Read job status before querying storage so a finishing job either causes
  // another poll or has already saved the item this request will return.
  const status = await briefingQueue(env).fetch(`https://internal/briefing-status?reader=${encodeURIComponent(userId)}`)
  if (!status.ok) return { success: false, error: 'Could not check archive updates.' }
  const runs = z.object({ report: progressSchema.nullable(), podcast: progressSchema.nullable() }).safeParse(await status.json())
  if (!runs.success) return { success: false, error: 'Could not check archive updates.' }
  // Older editions could be indexed under the previous month when saved
  // shortly after midnight on the first day of the month.
  const firstOfMonth = new Date(`${month}-01T00:00:00Z`)
  firstOfMonth.setUTCDate(0)
  const previousMonth = firstOfMonth.toISOString().slice(0, 7)
  const queryEditions = (period: string) => tools.query<SavedEdition>('reportEditions', {
    where: { userId, month: period }, orderBy: 'edition', orderDir: 'desc', limit: 65,
  })
  const [editions, earlierEditions, episodes, snapshot] = await Promise.all([
    queryEditions(month),
    queryEditions(previousMonth),
    tools.query<SavedEpisode>('podcastEpisodes', {
      where: { userId, month }, orderBy: 'publishedAt', orderDir: 'desc', limit: 100,
    }),
    tools.get<SavedBriefing>('briefings', userId),
  ])
  if (!editions.success || !earlierEditions.success || !episodes.success ||
      (!snapshot.success && snapshot.error !== RECORD_NOT_FOUND)) {
    return { success: false, error: 'Could not load your story archive.' }
  }
  const reports: { edition: string; report: Report }[] = []
  const records = [...editions.data.records, ...earlierEditions.data.records].map(({ data }) => data.report)
  if (snapshot.success && snapshot.data.record.data.report) records.push(snapshot.data.record.data.report)
  for (const raw of records) {
    const report = readStored(reportSchema, raw)
    if (!report || reports.some((item) => item.report.id === report.id)) continue
    const edition = mountainDay(new Date(report.createdAt))
    if (edition.startsWith(month)) reports.push({ edition, report })
  }
  const podcasts: { publishedAt: string; podcast: Podcast }[] = episodes.data.records.flatMap(({ data }) => {
    const podcast = readStored(podcastSchema, data.podcast)
    return podcast ? [{ publishedAt: data.publishedAt, podcast }] : []
  })
  if (snapshot.success) {
    // Old releases kept only one episode and its row modification time.
    const { data, updatedAt } = snapshot.data.record
    const podcast = readStored(podcastSchema, data.podcast)
    if (podcast && z.iso.datetime({ offset: true }).safeParse(updatedAt).success &&
        mountainDay(new Date(updatedAt)).startsWith(month) &&
        !podcasts.some(({ podcast: item }) => item.audioKey === podcast.audioKey)) {
      podcasts.push({ publishedAt: updatedAt, podcast })
    }
  }
  return {
    success: true,
    data: {
      reports: reports.sort((a, b) => b.report.createdAt.localeCompare(a.report.createdAt)),
      podcasts: podcasts.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
      pending: Object.values(runs.data).some((run) => run?.status === 'queued' || run?.status === 'running'),
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
    const published = await loadBriefing(tools, userId)
    if (!published) return { success: false, error: 'Could not check for today’s reports.' }
    if (published.todayReport?.sections.every((section) => section.category)) {
      return { success: true, data: { status: 'succeeded', message: 'Ready.' } }
    }
    payload = { kind: kind.data, userId, topics }
  } else {
    const data = await loadBriefing(tools, userId)
    const report = data?.latestReport
    if (!report || report.sections.some((section) => !section.category)) {
      return { success: false, error: 'Generate daily reports first.' }
    }
    payload = { kind: kind.data, userId, report }
  }

  const response = await enqueueBriefing(briefingQueue(env), payload)
  return response.json<Awaited<ReturnType<ActionHandler<Env>>>>()
}
