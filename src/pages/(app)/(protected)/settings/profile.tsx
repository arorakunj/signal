import { useState, type FormEvent } from 'react'
import { useAsyncResource, useAuthProfileReady } from 'deepspace'
import { useNavigate } from 'react-router-dom'
import SettingsEditor from '@/components/SettingsEditor'
import { Button, Input, Label } from '@/components/ui'
import { getProfileDetails, saveProfileDetails } from '@/lib/profile'
import type { ProfileDetails } from '@/lib/profile-details'

export default function ProfileSettings() {
  const { user, userLoading } = useAuthProfileReady({ requireUser: true })
  const profile = useAsyncResource(getProfileDetails, [])

  return (
    <SettingsEditor title="Profile" description="Manage the name and contact information on your Signal profile.">
      {profile.data && !userLoading && (
        <ProfileForm
          initial={{ displayName: profile.data.displayName || user?.name || '', contactEmail: profile.data.contactEmail }}
          signInEmail={user?.email}
        />
      )}
      {(profile.status === 'loading' || userLoading) && <p role="status">Loading your profile…</p>}
      {profile.status === 'error' && (
        <p role="alert" className="text-destructive">Could not load your profile.{' '}
          <button type="button" className="underline" onClick={profile.reload}>Try again</button>
        </p>
      )}
    </SettingsEditor>
  )
}

function ProfileForm({ initial, signInEmail }: { initial: ProfileDetails; signInEmail?: string }) {
  const navigate = useNavigate()
  const [name, setName] = useState(initial.displayName)
  const [email, setEmail] = useState(initial.contactEmail)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      await saveProfileDetails({ displayName: name, contactEmail: email })
      navigate('/settings', { replace: true, state: { notice: 'Profile saved.' } })
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not save your profile.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="space-y-5" onSubmit={submit}>
      <div className="space-y-2">
        <Label htmlFor="display-name">Display name</Label>
        <Input id="display-name" value={name} maxLength={80} required disabled={busy}
          autoComplete="name" onChange={(event) => setName(event.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="contact-email">Contact email <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <Input id="contact-email" type="email" value={email} maxLength={254} disabled={busy}
          autoComplete="email" onChange={(event) => setEmail(event.target.value)} />
      </div>
      {signInEmail && (
        <div className="rounded-xl border border-border bg-background px-4 py-3 text-sm">
          <p className="font-semibold">Sign-in email</p>
          <p className="mt-1 break-all">{signInEmail}</p>
          <p className="mt-1 text-muted-foreground">Managed by your sign-in provider.</p>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="rounded-full" disabled={!name.trim()} loading={busy}>Save profile</Button>
    </form>
  )
}
