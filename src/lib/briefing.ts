import { z } from 'zod'
import { categorySchema } from './interests'

export const generationKind = z.enum(['report', 'podcast'])
export type GenerationKind = z.infer<typeof generationKind>

const citationIds = z.array(z.string().min(1).max(20)).min(1).max(8)
const sourceSchema = z.object({
  id: z.string(), title: z.string(), url: z.url(), publisher: z.string(),
  publishedAt: z.string().nullable(),
})

export const reportDraft = z.object({
  title: z.string().trim().min(1).max(180),
  summary: z.string().trim().min(1).max(700),
  sections: z.array(z.object({
    heading: z.string().trim().min(1).max(220),
    category: categorySchema.optional(),
    categories: z.array(categorySchema).min(1).optional(),
    summary: z.string().trim().min(1).max(600).optional(),
    text: z.string().trim().min(1).max(4000),
    citations: citationIds,
  })).min(1).max(6),
})

export const dailyReportDraft = reportDraft.shape.sections.element
  .omit({ category: true, categories: true })
  .extend({
    groupId: z.union([z.number().int().min(1).max(3), z.enum(['1', '2', '3']).transform(Number)]),
  })

export const reportSchema = reportDraft.extend({
  id: z.string(),
  createdAt: z.iso.datetime({ offset: true }),
  sources: z.array(sourceSchema).min(1),
})
export type Report = z.infer<typeof reportSchema>

export const podcastDraft = z.object({
  title: z.string().trim().min(1).max(160),
  segments: z.array(z.object({
    text: z.string().trim().min(1).max(5000),
    citations: citationIds,
  })).min(1).max(12),
})

export const podcastSchema = z.object({
  reportId: z.string(),
  title: z.string(),
  transcript: z.string(),
  audioKey: z.string(),
  audioPath: z.string().startsWith('/api/files/'),
  sources: z.array(sourceSchema).min(1),
})
export type Podcast = z.infer<typeof podcastSchema>

export const archiveSchema = z.object({
  reports: z.array(z.object({ edition: z.iso.date(), report: reportSchema })),
  podcasts: z.array(z.object({ publishedAt: z.iso.datetime({ offset: true }), podcast: podcastSchema })),
  pending: z.boolean(),
})

export const BRIEFING_UPDATED = 'signal:briefing-updated'

export const progressSchema = z.object({
  status: z.enum(['queued', 'running', 'succeeded', 'failed', 'no_coverage']),
  message: z.string(),
})
export const briefingStatusSchema = z.object({
  report: progressSchema.nullable(),
  podcast: progressSchema.nullable(),
  latestReport: reportSchema.nullable(),
  todayReport: reportSchema.nullable(),
  latestPodcast: podcastSchema.nullable(),
})

export function readStored<T>(schema: z.ZodType<T>, raw?: string): T | null {
  if (!raw) return null
  try { return schema.parse(JSON.parse(raw)) } catch { return null }
}
