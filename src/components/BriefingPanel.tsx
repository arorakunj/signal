import { useEffect, useState } from 'react'
import { getAuthToken } from 'deepspace'
import { AudioLines, FileText, ArrowUpRight } from 'lucide-react'
import { z } from 'zod'
import { Link } from 'react-router-dom'
import { briefingStatusSchema, type GenerationKind, type Report } from '@/lib/briefing'

const actionResponse = z.discriminatedUnion('success', [
  z.object({ success: z.literal(true), data: z.unknown() }),
  z.object({ success: z.literal(false), error: z.string() }),
])

async function briefingAction(action: 'getBriefing' | 'startBriefing', kind?: GenerationKind) {
  const token = await getAuthToken()
  if (!token) throw new Error('Sign in again to access your briefing.')
  const response = await fetch(`/api/actions/${action}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind }),
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
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let current = true
    let timer: ReturnType<typeof setTimeout>
    async function refresh() {
      try {
        const next = briefingStatusSchema.parse(await briefingAction('getBriefing'))
        if (!current) return
        setBriefing(next)
        setPending(null)
        if (busy(next.report) || busy(next.podcast)) timer = setTimeout(refresh, 1800)
      } catch {
        if (current) {
          setPending(null)
          setError('Could not check briefing status. Try again.')
        }
      }
    }
    void refresh()
    return () => { current = false; clearTimeout(timer) }
  }, [attempt])

  async function generate(kind: GenerationKind) {
    setPending(kind)
    setError('')
    try {
      await briefingAction('startBriefing', kind)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not start generation.')
    } finally {
      setAttempt((value) => value + 1)
    }
  }

  const locked = pending !== null || busy(briefing?.report ?? null) || busy(briefing?.podcast ?? null)
  const report = briefing?.latestReport
  const podcast = briefing?.latestPodcast
  const run = briefing?.[kind]
  const isReport = kind === 'report'
  const isLegacyReport = report?.sections.some((section) => !section.category)
  return (
    <section className={isReport ? "mt-8" : undefined} aria-label="Your briefing">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {isReport && <h2 className="font-newsreader text-3xl tracking-tight sm:text-4xl">Top picks for you today</h2>}
        <button type="button" disabled={locked || !briefing || (!isReport && (!report || isLegacyReport))} onClick={() => void generate(kind)}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {isReport ? <FileText size={16} aria-hidden /> : <AudioLines size={16} aria-hidden />}
          {isReport ? 'Generate top picks' : 'Generate podcast'}
        </button>
      </div>
      {isReport ? (
        <p className="mt-3 text-sm text-muted-foreground">Up to three stories from your interests, based on coverage from the last 48 hours.</p>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          {report && !isLegacyReport
            ? 'Your podcast uses your latest picks. The length adapts to the amount of coverage.'
            : <>Generate your <Link to="/feed" className="text-primary underline">top picks</Link> first to make a podcast.</>}
        </p>
      )}
      <div className="mt-3 space-y-1 text-sm" aria-live="polite">
        {pending && <p>Starting generation…</p>}
        {run && run.status !== 'succeeded' && (
          <p className={run.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'}>{run.message}</p>
        )}
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}{' '}
        <button type="button" className="underline" onClick={() => { setError(''); setAttempt((value) => value + 1) }}>Refresh status</button>
      </p>}
      {isReport && report && !isLegacyReport && <StoryPicks key={report.id} report={report} />}
      {isReport && isLegacyReport && <p className="mt-6 text-sm text-muted-foreground">Generate new picks to see stories matched to your categories.</p>}
      {!isReport && podcast && (
        <article className="mt-6 rounded-2xl border border-border bg-card p-6 sm:p-8">
          <h2 className="font-newsreader text-3xl">{podcast.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">AI-generated podcast</p>
          <audio key={podcast.audioKey} className="mt-5 w-full" controls preload="metadata" src={podcast.audioPath} />
          <details className="mt-5">
            <summary className="cursor-pointer font-semibold">Transcript and sources</summary>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{podcast.transcript}</p>
            <SourceList sources={podcast.sources} />
          </details>
        </article>
      )}
    </section>
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

function StoryPicks({ report }: { report: Report }) {
  const [filter, setFilter] = useState<string | null>(null)
  const categories = report.sections.flatMap(({ category }) => category ? [category] : [])
  const stories = filter ? report.sections.filter(({ category }) => category === filter) : report.sections
  return (
    <div className="mt-5 grid gap-4">
      {categories.length > 1 && (
        <div className="flex flex-wrap gap-2" aria-label="Filter today’s picks">
          {[null, ...categories].map((category) => (
            <button key={category ?? 'all'} type="button" aria-pressed={filter === category} onClick={() => setFilter(category)}
              className="rounded-full border border-border px-3 py-1.5 text-sm aria-pressed:border-primary/60 aria-pressed:bg-primary/10 aria-pressed:text-primary">
              {category ?? 'All picks'}
            </button>
          ))}
        </div>
      )}
      {stories.map((story) => {
        const sources = report.sources.filter(({ id }) => story.citations.includes(id))
        return (
          <article key={story.category} className="rounded-2xl border border-border bg-card p-6 sm:p-8">
            <p className="text-sm font-semibold text-primary">{story.category}</p>
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
              AI-generated · {sources.length} {sources.length === 1 ? 'source' : 'sources'} · {new Date(report.createdAt).toLocaleDateString()}
            </p>
          </article>
        )
      })}
    </div>
  )
}
