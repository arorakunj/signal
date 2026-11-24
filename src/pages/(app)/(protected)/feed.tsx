import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import InterestOnboarding from '@/components/InterestOnboarding'
import { profileAction } from '@/lib/profile'

export default function Feed() {
  const [interests, setInterests] = useState<string[] | null>(null)
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

  // The server returns an empty list only when this account has no Signal profile.
  if (interests?.length === 0) return <InterestOnboarding onSaved={setInterests} />

  return (
    <section className="min-h-full bg-background px-6 py-16 text-foreground">
      <div className="mx-auto max-w-5xl">
        <h1 className="font-serif text-5xl tracking-tight">Your feed</h1>
        {error ? (
          <div className="mt-6">
            <p role="alert" className="text-destructive">{error}</p>
            <button className="mt-3 text-primary underline" onClick={() => { setError(''); setAttempt(attempt + 1) }}>Try again</button>
          </div>
        ) : interests === null ? <p role="status" className="mt-6 text-muted-foreground">Loading your interests…</p>
          : (
            <>
              <div className="mt-6 flex flex-wrap gap-2">
                {interests.map((topic) => <span key={topic} className="rounded-full border border-border px-3 py-1 text-sm text-foreground">{topic}</span>)}
              </div>
              <p className="mt-12 border-t border-border pt-7 text-muted-foreground">Your feed is empty.</p>
              <Link to="/settings" className="mt-4 inline-block text-sm text-primary underline">Manage interests</Link>
            </>
          )}
      </div>
    </section>
  )
}
