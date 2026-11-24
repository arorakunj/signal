import { useState } from 'react'
import { profileAction } from '@/lib/profile'
import InterestPicker from './InterestPicker'

export default function InterestOnboarding({ onSaved }: { onSaved: (interests: string[]) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(interests: string[]) {
    setError('')
    setBusy(true)
    try {
      const saved = await profileAction('saveInterests', interests)
      onSaved(saved)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not save your interests.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="min-h-full bg-background px-5 py-12 text-foreground sm:px-8 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-newsreader text-4xl leading-tight tracking-tight sm:text-6xl">Choose your interests</h1>
        <p className="mb-7 mt-3 max-w-lg text-base leading-relaxed text-muted-foreground sm:mb-9 sm:text-lg">
          Pick at least one topic to shape your feed and daily podcast. You can change your interests anytime in Settings.
        </p>
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-8">
          <InterestPicker label="Save interests" onSubmit={submit} busy={busy} />
          {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
        </div>
      </div>
    </section>
  )
}
