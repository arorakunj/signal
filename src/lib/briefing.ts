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
    heading: z.string().trim().min(1).max(160),
    category: categorySchema.optional(),
    summary: z.string().trim().min(1).max(360).optional(),
    text: z.string().trim().min(1).max(2300),
    citations: citationIds,
  })).min(1).max(6),
})

export const topPicksDraft = z.object({
  picks: z.array(reportDraft.shape.sections.element.required()).max(3),
})

export const reportSchema = reportDraft.extend({
  id: z.string(),
  createdAt: z.string(),
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

const progressSchema = z.object({
  status: z.enum(['queued', 'running', 'succeeded', 'failed']),
  message: z.string(),
})
export const briefingStatusSchema = z.object({
  report: progressSchema.nullable(),
  podcast: progressSchema.nullable(),
  latestReport: reportSchema.nullable(),
  latestPodcast: podcastSchema.nullable(),
})

export function readStored<T>(schema: z.ZodType<T>, raw?: string): T | null {
  if (!raw) return null
  try { return schema.parse(JSON.parse(raw)) } catch { return null }
}
