import { describe, expect, it, vi } from 'vitest'
import { generatePodcast, generateReport, podcastWordTarget } from './briefing-pipeline'
import { interestsSchema } from '../lib/interests'
import type { Report } from '../lib/briefing'

const excerpt = 'Researchers presented new measurements of coastal waters from a recent satellite pass.'
const source = {
  title: 'Researchers publish coastal measurements',
  url: 'https://example.org/ocean?utm_source=newsletter',
  highlights: [excerpt],
}
const draft = {
  title: 'A closer look at the coast',
  summary: 'Scientists examined recent satellite measurements.',
  sections: [{ category: 'Science' as const, heading: 'Ocean research', summary: 'New coastal measurements.', text: excerpt, citations: ['S1'] }],
}
const claude = (value: unknown) => ({ content: [{ type: 'text', text: JSON.stringify(value) }] })

describe('briefing pipeline', () => {
  it('searches 48 hours, deduplicates URLs and persists only valid source references', async () => {
    const integrate = vi.fn(async (endpoint: string) => endpoint === 'exa/search'
      ? { results: [source, { ...source, url: 'https://example.org/ocean#top' }, { ...source, title: 'Election results' }] }
      : claude({ picks: draft.sections }))
    const report = await generateReport(integrate, [{ category: 'Science', focus: [] }], () => {})
    expect(integrate).toHaveBeenCalledTimes(2)
    const input = integrate.mock.calls[0] as unknown as [string, { startPublishedDate: string }]
    expect(Date.now() - Date.parse(input[1].startPublishedDate)).toBeCloseTo(48 * 3600_000, -3)
    expect(report.sources).toEqual([{
      id: 'S1', title: source.title, url: 'https://example.org/ocean', publisher: 'example.org', publishedAt: null,
    }])
    expect(report.sections[0].citations).toEqual(['S1'])
  })

  it('skips generation if no usable evidence remains', async () => {
    const integrate = vi.fn(async () => ({ results: [{ invalid: true }] }))
    await expect(generateReport(integrate, [{ category: 'Science', focus: [] }], () => {})).rejects.toThrow('No usable coverage')
    expect(integrate).toHaveBeenCalledTimes(1)
  })

  it('rejects an invented source ID', async () => {
    const integrate = async (endpoint: string) => endpoint === 'exa/search'
      ? { results: [source] }
      : claude({ picks: [{ ...draft.sections[0], citations: ['S99'] }] })
    await expect(generateReport(integrate, [{ category: 'Science', focus: [] }], () => {})).rejects.toThrow('No verified picks')
  })

  it('uses music specifics, excludes health studies and keeps picks in distinct categories', async () => {
    const tour = { ...source, title: 'Artist announces jazz world tour', url: 'https://example.org/jazz-tour' }
    const musicStudy = { ...source, title: 'Music shows benefits for child development and patient health outcomes', url: 'https://example.org/study' }
    const musicPick = { ...draft.sections[0], category: 'Music', heading: 'A new jazz tour', citations: ['S1'] }
    const sciencePick = { ...draft.sections[0], citations: ['S2'] }
    const integrate = vi.fn(async (endpoint: string, input: Record<string, unknown>) => {
      if (endpoint !== 'exa/search') {
        const { evidence } = JSON.parse((input.messages as { content: string }[])[0].content)
        expect(evidence.map(({ title }: { title: string }) => title)).toEqual([tour.title, source.title])
        return claude({ picks: [musicPick, { ...musicPick, citations: ['S2'] }, sciencePick] })
      }
      if (String(input.query).includes('Music')) {
        expect(input.query).toContain('Jazz guitar')
        return { results: [musicStudy, tour] }
      }
      return { results: [source] }
    })
    const report = await generateReport(integrate, [
      { category: 'Music', focus: ['Jazz guitar'] }, { category: 'Science', focus: [] },
    ], () => {})
    expect(report.sections.map(({ category }) => category)).toEqual(['Music', 'Science'])
    expect(report.sources.map(({ title }) => title)).toEqual([tour.title, source.title])
  })

  it('preserves older interest profiles and maps them into categories', () => {
    expect(interestsSchema.parse(['Music', 'Jazz guitar'])).toEqual([{ category: 'Music', focus: ['Jazz guitar'] }])
    expect(interestsSchema.parse(['Artificial intelligence', 'Space'])).toEqual([
      { category: 'Technology', focus: ['Artificial intelligence'] },
      { category: 'Science', focus: ['Space'] },
    ])
  })

  const report: Report = {
    ...draft, id: 'report-1', createdAt: '2026-11-23T12:00:00Z',
    sources: [{ ...source, id: 'S1', publisher: 'example.org', publishedAt: null }],
  }

  it('scales episode targets and sends only the supported narration to speech synthesis', async () => {
    const longer = { ...report, sections: Array.from({ length: 5 }, () => ({ ...draft.sections[0], text: 'Research '.repeat(150) })) }
    expect(podcastWordTarget(longer)).toBeGreaterThan(podcastWordTarget(report))
    const integrate = vi.fn(async (endpoint: string, _input: Record<string, unknown>) => endpoint === 'anthropic/chat-completion'
      ? claude({ title: 'Ocean briefing', segments: [{ text: excerpt, citations: ['S1'] }] })
      : { audioUrl: 'data:audio/mpeg;base64,SUQz' })
    const podcast = await generatePodcast(integrate, report, () => {})
    expect(integrate.mock.calls.map(([endpoint]) => endpoint)).toEqual(['anthropic/chat-completion', 'elevenlabs/generate-speech'])
    expect(integrate.mock.calls[1][1].text).toBe(excerpt)
    expect(podcast.audio.type).toBe('audio/mpeg')
  })

  it('does not call ElevenLabs for an unsupported script', async () => {
    const integrate = vi.fn(async () => claude({ title: 'Ocean briefing', segments: [{ text: excerpt, citations: ['S99'] }] }))
    await expect(generatePodcast(integrate, report, () => {})).rejects.toThrow('unknown source')
    expect(integrate).toHaveBeenCalledTimes(1)
  })
})
