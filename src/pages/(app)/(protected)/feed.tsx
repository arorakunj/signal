import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import BriefingPanel from '@/components/BriefingPanel'
import InterestOnboarding from '@/components/InterestOnboarding'
import { profileAction } from '@/lib/profile'
import type { Interest } from '@/lib/interests'

export default function Feed() {
  const [params, setParams] = useSearchParams()
  const [interests, setInterests] = useState<Interest[] | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const saved = await profileAction('getInterests')
        if (active) setInterests(saved)
      } catch (failure) {
        if (active) setError(failure instanceof Error ? failure.message : 'Could not load your feed.')
      }
    }
    void load()
    return () => { active = false }
  }, [attempt])

  function completeReview() {
    setParams((current) => {
      const next = new URLSearchParams(current)
      next.delete('review-interests')
      return next
    }, { replace: true })
  }

  if (interests && (!interests.length || params.has('review-interests'))) {
    return (
      <InterestOnboarding
        interests={interests}
        onSaved={(saved) => {
          setInterests(saved)
          completeReview()
        }}
        onContinue={interests.length ? completeReview : undefined}
      />
    )
  }

  return (
    <section className="min-h-full bg-background px-6 py-16 text-foreground">
      <div className="mx-auto max-w-5xl">
        <h1 className="font-newsreader text-5xl tracking-tight">Your feed</h1>
        {error ? (
          <div className="mt-6">
            <p role="alert" className="text-destructive">{error}</p>
            <button className="mt-3 text-primary underline" onClick={() => { setError(''); setAttempt(attempt + 1) }}>Try again</button>
          </div>
        ) : interests === null ? <p role="status" className="mt-6 text-muted-foreground">Loading your interests…</p>
          : (
            <>
              <ul className="mt-6 flex flex-wrap gap-2" aria-label="Your interests">
                {interests.map(({ category, focus }) => (
                  <li key={category} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-xl border border-border bg-card px-3 py-2 text-sm">
                    <span className="font-semibold">{category}</span>
                    {focus.map((topic) => <span key={topic} className="text-muted-foreground">{topic}</span>)}
                  </li>
                ))}
              </ul>
              <BriefingPanel kind="report" />
              <Link to="/settings" className="mt-4 inline-block text-sm text-primary underline">Manage interests</Link>
            </>
          )}
      </div>
    </section>
  )
}
