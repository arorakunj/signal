import { useState } from 'react'
import { profileAction } from '@/lib/profile'
import type { Interest } from '@/lib/interests'
import InterestPicker from './InterestPicker'

export default function InterestOnboarding({
  interests = [],
  onSaved,
  onContinue,
}: {
  interests?: Interest[]
  onSaved: (interests: Interest[]) => void
  onContinue?: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(interests: Interest[]) {
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
        <h1 className="font-newsreader text-4xl leading-tight tracking-tight sm:text-6xl">{onContinue ? 'Review your interests' : 'Choose your interests'}</h1>
        <p className="mb-7 mt-3 max-w-lg text-base leading-relaxed text-muted-foreground sm:mb-9 sm:text-lg">
          {onContinue
            ? 'Update the topics you follow or continue with your saved interests.'
            : 'Pick at least one topic to shape your feed and daily podcast. You can change your interests anytime in Settings.'}
        </p>
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-8">
          <InterestPicker initial={interests} label="Save interests" onSubmit={submit} busy={busy} />
          {onContinue && (
            <button type="button" disabled={busy} onClick={onContinue}
              className="mt-4 text-sm font-semibold text-primary underline underline-offset-4 disabled:opacity-50">
              Continue to feed
            </button>
          )}
          {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
        </div>
      </div>
    </section>
  )
}
