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
      : claude({ reports: [{ ...draft.sections[0], groupId: 1 }] }))
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
    await expect(generateReport(integrate, [{ category: 'Science', focus: [] }], () => {})).rejects.toThrow('couldn’t find any new, source-backed stories')
    expect(integrate).toHaveBeenCalledTimes(1)
  })

  it('rejects an invented source ID', async () => {
    const integrate = async (endpoint: string) => endpoint === 'exa/search'
      ? { results: [source] }
      : claude({ reports: [{ ...draft.sections[0], groupId: 1, citations: ['S99'] }] })
    await expect(generateReport(integrate, [{ category: 'Science', focus: [] }], () => {})).rejects.toThrow('No verified reports')
  })

  it('uses music specifics, excludes health studies and keeps picks in distinct categories', async () => {
    const tour = { ...source, title: 'Artist announces jazz world tour', url: 'https://example.org/jazz-tour' }
    const musicStudy = { ...source, title: 'Music shows benefits for child development and patient health outcomes', url: 'https://example.org/study' }
    const musicPick = { ...draft.sections[0], groupId: 1, heading: 'A new jazz tour', citations: ['S1'] }
    const sciencePick = { ...draft.sections[0], groupId: 2, citations: ['S2'] }
    const integrate = vi.fn(async (endpoint: string, input: Record<string, unknown>) => {
      if (endpoint !== 'exa/search') {
        const request = JSON.parse((input.messages as { content: string }[])[0].content)
        if (Array.isArray(request)) return claude({ groups: [['Music'], ['Science']] })
        const { evidence } = request
        expect(evidence.map(({ title }: { title: string }) => title)).toEqual([tour.title, source.title])
        return claude({ reports: [{ ...musicPick, citations: ['S2'] }, musicPick, sciencePick] })
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

  it('groups related interests, gives them more room and looks up grouped specifics together', async () => {
    const integrate = vi.fn(async (endpoint: string, input: Record<string, unknown>) => {
      if (endpoint === 'exa/search') return { results: [source] }
      const request = JSON.parse((input.messages as { content: string }[])[0].content)
      if (Array.isArray(request)) return claude({ groups: [['Science', 'Technology'], ['Gaming']] })
      expect(request.groups[0].targetWords).toBeGreaterThan(request.groups[1].targetWords)
      return claude({ reports: [
        { ...draft.sections[0], groupId: 1, citations: ['S1'] },
        { ...draft.sections[0], groupId: 2, citations: ['S1'] },
      ] })
    })
    const report = await generateReport(integrate, [
      { category: 'Science', focus: ['Satellites'] }, { category: 'Technology', focus: ['AI'] }, { category: 'Gaming', focus: [] },
    ], () => {})
    expect(report.sections.map(({ categories }) => categories)).toEqual([['Science', 'Technology']])
    expect(integrate.mock.calls[1][1].query).toMatch(/Science.*Satellites.*Technology.*AI/)
  })

  it('refuses a plan that drops preferences before buying search results', async () => {
    const integrate = vi.fn(async () => claude({ groups: [['Music']] }))
    await expect(generateReport(integrate, [{ category: 'Music', focus: [] }, { category: 'Sports', focus: [] }], () => {}))
      .rejects.toThrow('valid set of report topics')
    expect(integrate).toHaveBeenCalledTimes(1)
  })

  it('keeps a verified story when another group has an invalid draft', async () => {
    const integrate = vi.fn(async (endpoint: string, input: Record<string, unknown>) => {
      if (endpoint === 'exa/search') return { results: [source] }
      const request = JSON.parse((input.messages as { content: string }[])[0].content)
      if (Array.isArray(request)) return claude({ groups: [['Science'], ['Music']] })
      return claude({ reports: [
        { ...draft.sections[0], groupId: 1 },
        { ...draft.sections[0], groupId: 2, text: 'x'.repeat(4001), citations: ['S2'] },
      ] })
    })
    const report = await generateReport(integrate, [
      { category: 'Science', focus: [] }, { category: 'Music', focus: [] },
    ], () => {})
    expect(report.sections.map(({ category }) => category)).toEqual(['Science'])
    expect(report.sources.map(({ id }) => id)).toEqual(['S1'])
  })

  it('accepts a numeric-string group ID and an omitted summary without weakening citations', async () => {
    const integrate = async (endpoint: string) => endpoint === 'exa/search'
      ? { results: [source] }
      : claude({ reports: [{ groupId: '1', heading: 'Ocean research', text: excerpt, citations: ['S1'] }] })
    const report = await generateReport(integrate, [{ category: 'Science', focus: [] }], () => {})
    expect(report.sections[0]).toMatchObject({ category: 'Science', citations: ['S1'] })
  })

  it('retries a malformed draft for Rubik’s cubes with the same evidence', async () => {
    const cube = { ...source, title: 'Speedcubing tournament announces finalists',
      highlights: ['Organizers published the finalists for the weekend speedcubing tournament.'] }
    const integrate = vi.fn()
      .mockResolvedValueOnce({ results: [cube] })
      .mockResolvedValueOnce(claude({ reports: [{ groupId: 1, heading: null, citations: ['S1'] }] }))
      .mockResolvedValueOnce(claude({ reports: [
        { heading: cube.title, text: cube.highlights[0], summary: null, citations: ['S1'] },
      ] }))
    const report = await generateReport(integrate, [{ category: 'Other interests', focus: ["rubik's cubes"] }], () => {})
    expect(report.sections[0]).toMatchObject({ heading: cube.title, citations: ['S1'] })
    expect(integrate.mock.calls.map(([endpoint]) => endpoint)).toEqual([
      'exa/search', 'anthropic/chat-completion', 'anthropic/chat-completion',
    ])
    expect(integrate.mock.calls[1][1].messages).toEqual(integrate.mock.calls[2][1].messages)
  })

  it.each([
    [],
    [{ groupId: 1, heading: null, text: null, citations: [] }],
  ].map((reports) => ({ reports })))('reports insufficient evidence without retrying when Claude returns $reports', async ({ reports }) => {
    const integrate = vi.fn()
      .mockResolvedValueOnce({ results: [source] })
      .mockResolvedValueOnce(claude({ reports }))
    await expect(generateReport(integrate, [{ category: 'Other interests', focus: ["rubik's cubes"] }], () => {}))
      .rejects.toThrow('couldn’t find any new, source-backed stories')
    expect(integrate).toHaveBeenCalledTimes(2)
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
