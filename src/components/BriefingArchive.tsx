import { useEffect, useId, useState } from 'react'
import { useAsyncResource } from 'deepspace'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { briefingAction, PodcastCard, ReportCards } from '@/components/BriefingPanel'
import { archiveSchema, BRIEFING_UPDATED } from '@/lib/briefing'
import { mountainDay } from '@/lib/edition'

const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeZone: 'UTC' })

function shiftDay(day: string, offset: number) {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}

export default function BriefingArchive({ podcastsOnly = false }: { podcastsOnly?: boolean }) {
  const today = mountainDay()
  const [day, setDay] = useState(today)
  const dateId = useId()
  const month = day.slice(0, 7)
  const archive = useAsyncResource(async () => ({
    month, ...archiveSchema.parse(await briefingAction('listReportEditions', { month })),
  }), [month], { keepPreviousData: true })
  const { reload } = archive
  const data = archive.data?.month === month ? archive.data : null
  useEffect(() => {
    window.addEventListener(BRIEFING_UPDATED, reload)
    return () => window.removeEventListener(BRIEFING_UPDATED, reload)
  }, [reload])
  useEffect(() => {
    if (archive.status !== 'ready' || !data?.pending) return
    const timer = window.setTimeout(reload, 1800)
    return () => window.clearTimeout(timer)
  }, [archive.status, data, reload])

  const reports = podcastsOnly ? [] : data?.reports.filter(({ edition }) => edition === day) ?? []
  const podcasts = podcastsOnly ? data?.podcasts.filter(({ publishedAt }) => mountainDay(new Date(publishedAt)) === day) ?? [] : []

  return (
    <div>
      <div className="mt-7">
        <label htmlFor={dateId} className="text-sm font-semibold">Archive date</label>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button type="button" aria-label="Previous day" onClick={() => setDay((value) => shiftDay(value, -1))}
            className="grid size-11 place-items-center rounded-lg border border-border bg-card hover:bg-accent"><ChevronLeft aria-hidden /></button>
          <input id={dateId} type="date" value={day} max={today}
            onChange={(event) => {
              const { value, validity } = event.currentTarget
              if (value && validity.valid) setDay(value)
            }}
            className="h-11 min-w-0 rounded-lg border border-border bg-card px-3 text-base text-foreground focus-visible:outline-2 focus-visible:outline-primary" />
          <button type="button" aria-label="Next day" disabled={day >= today} onClick={() => setDay((value) => shiftDay(value, 1))}
            className="grid size-11 place-items-center rounded-lg border border-border bg-card hover:bg-accent disabled:opacity-40"><ChevronRight aria-hidden /></button>
        </div>
      </div>
      <section aria-labelledby={`${dateId}-heading`} className="mt-8 border-t border-border pt-5">
        <h2 id={`${dateId}-heading`} className="font-newsreader text-3xl" aria-live="polite">
          <time dateTime={day}>{dateFormat.format(new Date(`${day}T00:00:00Z`))}</time>
        </h2>
        {!data && (archive.status === 'idle' || archive.status === 'loading') ? <p role="status" className="mt-4 text-muted-foreground">Loading archive…</p>
          : archive.error ? <p role="alert" className="mt-4 text-destructive">Could not load your archive. <button className="underline" onClick={reload}>Try again</button></p>
          : reports.length ? reports.map(({ report }) => <ReportCards key={report.id} report={report} />)
          : podcasts.length ? <div className="mt-5 space-y-4">
            {podcasts.map(({ podcast }) => <PodcastCard key={podcast.audioKey} podcast={podcast} />)}
          </div>
          : <p className="mt-4 text-muted-foreground">{podcastsOnly ? 'No podcasts on this date.' : 'No stories on this date.'}</p>}
      </section>
    </div>
  )
}
