import { useEffect, useState } from 'react'
import InterestPicker from '@/components/InterestPicker'
import { profileAction } from '@/lib/profile'

export default function Settings() {
  const [interests, setInterests] = useState<string[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    profileAction('getInterests').then(
      (data) => { if (active) setInterests(data) },
      () => { if (active) setError('Could not load your interests.') },
    )
    return () => { active = false }
  }, [attempt])

  async function save(next: string[]) {
    setBusy(true)
    setError('')
    setSaved(false)
    try {
      await profileAction('saveInterests', next)
      setSaved(true)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not save your interests.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="min-h-full bg-background px-6 py-16 text-foreground">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-8 font-serif text-5xl tracking-tight">Your interests</h1>
        {interests ? <InterestPicker initial={interests} label="Save interests" onSubmit={save} busy={busy} />
          : !error && <p role="status">Loading your interests…</p>}
        {error && <p role="alert" className="mt-4 text-destructive">{error}</p>}
        {error && !interests && <button className="mt-3 text-primary underline" onClick={() => { setError(''); setAttempt(attempt + 1) }}>Try again</button>}
        {saved && <p role="status" className="mt-4 text-primary">Interests saved.</p>}
      </div>
    </section>
  )
}
