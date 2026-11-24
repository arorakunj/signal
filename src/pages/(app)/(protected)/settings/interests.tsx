import { useState } from 'react'
import { useAsyncResource } from 'deepspace'
import { useNavigate } from 'react-router-dom'
import InterestPicker from '@/components/InterestPicker'
import SettingsEditor from '@/components/SettingsEditor'
import { profileAction } from '@/lib/profile'
import type { Interest } from '@/lib/interests'

export default function InterestSettings() {
  const navigate = useNavigate()
  const interests = useAsyncResource(() => profileAction('getInterests'), [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save(next: Interest[]) {
    setBusy(true)
    setError('')
    try {
      await profileAction('saveInterests', next)
      navigate('/settings', { replace: true, state: { notice: 'Interests saved.' } })
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not save your interests.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <SettingsEditor title="Your interests" description="Choose the categories and specifics that shape your top picks.">
      {interests.data && <InterestPicker initial={interests.data} label="Save interests" onSubmit={save} busy={busy} />}
      {interests.status === 'loading' && <p role="status">Loading your interests…</p>}
      {interests.status === 'error' && (
        <p role="alert" className="text-destructive">Could not load your interests.{' '}
          <button type="button" className="underline" onClick={interests.reload}>Try again</button>
        </p>
      )}
      {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
    </SettingsEditor>
  )
}
