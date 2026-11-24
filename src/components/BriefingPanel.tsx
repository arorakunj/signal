import { useEffect, useRef, useState } from 'react'
import { getAuthToken } from 'deepspace'
import { AudioLines, FileText, ArrowUpRight } from 'lucide-react'
import { z } from 'zod'
import { Link } from 'react-router-dom'
import { BRIEFING_UPDATED, briefingStatusSchema, type GenerationKind, type Podcast, type Report } from '@/lib/briefing'
import { editionDay } from '@/lib/edition'

const actionResponse = z.discriminatedUnion('success', [
  z.object({ success: z.literal(true), data: z.unknown() }),
  z.object({ success: z.literal(false), error: z.string() }),
])

export async function briefingAction(action: 'getBriefing' | 'startBriefing' | 'listReportEditions', params: object = {}) {
  const token = await getAuthToken()
  if (!token) throw new Error('Sign in again to access your briefing.')
  const response = await fetch(`/api/actions/${action}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  const result = actionResponse.safeParse(await response.json())
  if (!result.success) throw new Error('Could not access briefings. Try again.')
  if (!result.data.success) throw new Error(result.data.error)
  if (!response.ok) throw new Error('Could not access briefings. Try again.')
  return result.data.data
}

type Briefing = z.infer<typeof briefingStatusSchema>
const busy = (run: Briefing['report']) => run?.status === 'queued' || run?.status === 'running'

export default function BriefingPanel({ kind }: { kind: GenerationKind }) {
  const [briefing, setBriefing] = useState<Briefing | null>(null)
  const [pending, setPending] = useState<GenerationKind | null>(null)
  const [error, setError] = useState<{ message: string; canRefresh?: boolean } | null>(null)
  const [notice, setNotice] = useState('')
  const [attempt, setAttempt] = useState(0)
  const watchingRun = useRef(false)

  useEffect(() => {
    let current = true
    let timer: ReturnType<typeof setTimeout>
    async function refresh() {
      try {
        const next = briefingStatusSchema.parse(await briefingAction('getBriefing'))
        if (!current) return
        const run = next[kind]
        if (busy(run)) {
          watchingRun.current = true
        } else {
          if (watchingRun.current && run?.status === 'failed') setError({ message: run.message })
          if (watchingRun.current && run?.status === 'no_coverage') setNotice(run.message)
          watchingRun.current = false
        }
        setBriefing(next)
        setPending(null)
        if (busy(next.report) || busy(next.podcast)) timer = setTimeout(refresh, 1800)
      } catch {
        if (current) {
          setPending(null)
          setError({ message: 'Could not check briefing status.', canRefresh: true })
        }
      }
    }
    void refresh()
    return () => { current = false; clearTimeout(timer) }
  }, [attempt, kind])

  useEffect(() => {
    if (kind !== 'report') return
    let day = editionDay()
    function checkDay() {
      const next = editionDay()
      if (day === next) return
      day = next
      setAttempt((value) => value + 1)
    }
    const timer = window.setInterval(checkDay, 10_000)
    document.addEventListener('visibilitychange', checkDay)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', checkDay)
    }
  }, [kind])

  async function generate() {
    setPending(kind)
    setError(null)
    setNotice('')
    try {
      await briefingAction('startBriefing', { kind })
      watchingRun.current = true
      window.dispatchEvent(new Event(BRIEFING_UPDATED))
    } catch (failure) {
      setError({ message: failure instanceof Error ? failure.message : 'Could not start generation.' })
    } finally {
      setAttempt((value) => value + 1)
    }
  }

  const locked = pending !== null || busy(briefing?.report ?? null) || busy(briefing?.podcast ?? null)
  const isReport = kind === 'report'
  const report = isReport ? briefing?.todayReport : briefing?.latestReport
  const run = briefing?.[kind]
  const isLegacyReport = report?.sections.some((section) => !section.category)
  const hasStoriesToday = isReport && !!report && !isLegacyReport
  const canGenerate = isReport ? !hasStoriesToday : !!report && !isLegacyReport
  return (
    <section className={isReport ? "mt-8" : undefined} aria-label="Your briefing">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {isReport && <h2 className="font-newsreader text-3xl tracking-tight sm:text-4xl">Today’s reports</h2>}
        <button type="button" disabled={locked || !briefing || !canGenerate} onClick={() => void generate()}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {isReport ? <FileText size={16} aria-hidden /> : <AudioLines size={16} aria-hidden />}
          {isReport ? 'Generate stories' : 'Generate podcast'}
        </button>
      </div>
      {isReport ? (
        <p className="mt-3 text-sm text-muted-foreground">{hasStoriesToday
          ? 'Today’s stories are ready. You can generate a new set after 5 a.m. MST.'
          : 'Generate up to three stories from your interests using coverage from the last 48 hours.'}</p>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          {report && !isLegacyReport
            ? 'Your podcast uses your latest reports. The length adapts to the amount of coverage.'
            : <>Generate your <Link to="/feed" className="text-primary underline">daily reports</Link> first to make a podcast.</>}
        </p>
      )}
      <div className="mt-3 space-y-1 text-sm" aria-live="polite">
        {pending && <p>Starting generation…</p>}
        {busy(run ?? null) && <p className="text-muted-foreground">{run?.message}</p>}
        {notice && <p className="text-muted-foreground">{notice}</p>}
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error.message}{' '}
        {error.canRefresh && <button type="button" className="underline" onClick={() => { setError(null); setAttempt((value) => value + 1) }}>Refresh status</button>}
      </p>}
      {isReport && report && !isLegacyReport && <ReportCards key={report.id} report={report} filterable />}
      {isReport && isLegacyReport && <p className="mt-6 text-sm text-muted-foreground">Generate new reports to see stories matched to your interests.</p>}
    </section>
  )
}

export function PodcastCard({ podcast }: { podcast: Podcast }) {
  return (
    <article className="rounded-2xl border border-border bg-card p-6 sm:p-8">
      <h3 className="font-newsreader text-3xl">{podcast.title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">AI-generated podcast</p>
      <audio aria-label={podcast.title} className="mt-5 w-full" controls preload="metadata" src={podcast.audioPath} />
      <details className="mt-5">
        <summary className="cursor-pointer font-semibold">Transcript and sources</summary>
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{podcast.transcript}</p>
        <SourceList sources={podcast.sources} />
      </details>
    </article>
  )
}

function SourceList({ sources }: { sources: Report['sources'] }) {
  return (
    <ul className="mt-3 space-y-2 text-sm">
      {sources.map((source) => (
        <li key={source.id}>
          <a href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary underline underline-offset-2">
            {source.title}<ArrowUpRight size={12} aria-hidden />
          </a>
          {' · '}{source.publisher}
        </li>
      ))}
    </ul>
  )
}

export function ReportCards({ report, filterable = false }: { report: Report; filterable?: boolean }) {
  const [filter, setFilter] = useState<NonNullable<Report['sections'][number]['category']> | null>(null)
  const storyCategories = ({ categories, category }: Report['sections'][number]) => categories ?? (category ? [category] : [])
  const categories = [...new Set(report.sections.flatMap(storyCategories))]
  const stories = filter ? report.sections.filter((story) => storyCategories(story).includes(filter)) : report.sections
  return (
    <div className="mt-5 grid gap-4">
      {filterable && categories.length > 1 && (
        <div className="flex flex-wrap gap-2" aria-label="Filter today’s reports">
          {[null, ...categories].map((category) => (
            <button key={category ?? 'all'} type="button" aria-pressed={filter === category} onClick={() => setFilter(category)}
              className="rounded-full border border-border px-3 py-1.5 text-sm aria-pressed:border-primary/60 aria-pressed:bg-primary/10 aria-pressed:text-primary">
              {category ?? 'All reports'}
            </button>
          ))}
        </div>
      )}
      {stories.map((story) => {
        const sources = report.sources.filter(({ id }) => story.citations.includes(id))
        return (
          <article key={story.heading} className="rounded-2xl border border-border bg-card p-6 sm:p-8">
            <p className="text-sm font-semibold text-primary">{storyCategories(story).join(' · ')}</p>
            <h3 className="mt-2 font-newsreader text-3xl leading-tight">{story.heading}</h3>
            <p className="mt-2 leading-relaxed text-muted-foreground">{story.summary}</p>
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-semibold text-primary">Read story and sources</summary>
              <p className="mt-3 whitespace-pre-line leading-relaxed">
                {story.text}{' '}
                {sources.map((source, index) => (
                  <a key={source.id} href={source.url} target="_blank" rel="noreferrer"
                    className="mr-1 text-sm font-medium text-primary underline" aria-label={source.title}>[{index + 1}]</a>
                ))}
              </p>
              <SourceList sources={sources} />
            </details>
            <p className="mt-4 text-xs text-muted-foreground">
              AI-generated · {sources.length} {sources.length === 1 ? 'source' : 'sources'}
            </p>
          </article>
        )
      })}
    </div>
  )
}
