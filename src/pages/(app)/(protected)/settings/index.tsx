import { useState, type FormEvent } from 'react'
import { signOut, useAsyncResource } from 'deepspace'
import { ChevronRight, SlidersHorizontal, UserRound } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import {
  Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle, Input, Label,
} from '@/components/ui'
import { deleteSignalAccount, getProfileDetails } from '@/lib/profile'

export default function Settings() {
  const { state } = useLocation()
  const notice: unknown = state?.notice
  const profile = useAsyncResource(getProfileDetails, [])
  const displayName = profile.data?.displayName
  const contactEmail = profile.data?.contactEmail

  return (
    <section className="min-h-full bg-background px-5 py-10 text-foreground sm:px-8 sm:py-16">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-newsreader text-5xl tracking-tight">Settings</h1>
        <p className="mt-2 text-muted-foreground">Manage your Signal account and what shows up in your feed.</p>
        {typeof notice === 'string' && (
          <p role="status" className="mt-5 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm font-semibold text-primary">{notice}</p>
        )}

        <div className="mt-7 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          <Link to="/settings/interests" className="flex items-center gap-4 p-5 hover:bg-accent/50 sm:p-6">
            <SlidersHorizontal size={20} className="shrink-0 text-primary" aria-hidden />
            <div className="flex-1">
              <h2 className="font-semibold">Your interests</h2>
              <p className="mt-1 text-sm text-muted-foreground">Edit your categories and specific interests.</p>
            </div>
            <ChevronRight size={18} className="shrink-0 text-muted-foreground" aria-hidden />
          </Link>
          <Link to="/settings/profile" className="flex items-center gap-4 p-5 hover:bg-accent/50 sm:p-6">
            <UserRound size={20} className="shrink-0 text-primary" aria-hidden />
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold">Profile</h2>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {displayName ? [displayName, contactEmail].filter(Boolean).join(' · ') : 'Manage your display name and contact email.'}
              </p>
            </div>
            <ChevronRight size={18} className="shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </div>

        <section className="mt-9 rounded-2xl border border-border bg-card p-5 sm:p-6" aria-labelledby="account-heading">
          <h2 id="account-heading" className="font-newsreader text-2xl tracking-tight">Account</h2>
          <p className="mb-4 mt-1.5 text-sm text-muted-foreground">Permanently delete your Signal profile, saved interests, picks, and podcast audio.</p>
          <DeleteAccount />
        </section>
      </div>
    </section>
  )
}

function DeleteAccount() {
  const [open, setOpen] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function changeOpen(next: boolean) {
    if (busy) return
    setOpen(next)
    setConfirmation('')
    setError('')
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (confirmation !== 'DELETE' || busy) return
    setBusy(true)
    setError('')
    try {
      await deleteSignalAccount(confirmation)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not delete your account.')
      setBusy(false)
      return
    }

    try {
      const result = await signOut()
      if (result.error) throw new Error('Session sign-out failed.')
      window.location.replace('/')
    } catch {
      setError('Your Signal data was deleted. Sign out from the account menu to end this session.')
      setBusy(false)
    }
  }

  return (
    <>
      <Button variant="outline" className="rounded-full text-destructive hover:text-destructive" onClick={() => changeOpen(true)}>
        Delete account
      </Button>
      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent hideClose={busy}>
          <DialogHeader>
            <DialogTitle>Delete your Signal account?</DialogTitle>
            <DialogDescription>
              This permanently deletes your Signal profile, saved interests, picks, and podcast files.
              Your Google, GitHub, or DeepSpace sign-in account stays available.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="delete-confirmation">Type DELETE to confirm</Label>
              <Input id="delete-confirmation" value={confirmation} autoComplete="off" disabled={busy}
                onChange={(event) => setConfirmation(event.target.value)} />
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button variant="outline" disabled={busy} onClick={() => changeOpen(false)}>Cancel</Button>
              <Button type="submit" variant="destructive" disabled={confirmation !== 'DELETE'} loading={busy}>
                Permanently delete
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
