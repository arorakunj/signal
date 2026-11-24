import { useState, type FormEvent } from 'react'
import { ArrowRight, Check, Plus, X } from 'lucide-react'
import { topics } from '../lib/interests'

export default function InterestPicker({
  initial = [], label, onSubmit, busy = false,
}: {
  initial?: string[]
  label: string
  onSubmit: (interests: string[]) => void
  busy?: boolean
}) {
  const [selected, setSelected] = useState(initial)
  const [custom, setCustom] = useState('')
  const addCustom = () => {
    const name = custom.trim()
    if (!name || selected.length >= 16) return
    const topic = topics.find((item) => item.toLowerCase() === name.toLowerCase()) ?? name
    if (!selected.some((item) => item.toLowerCase() === topic.toLowerCase())) {
      setSelected([...selected, topic])
    }
    setCustom('')
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (selected.length && !busy) onSubmit(selected)
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <fieldset disabled={busy}>
        <legend className="mb-3 text-sm font-semibold text-foreground">Topics</legend>
        <div className="flex flex-wrap gap-2">
          {topics.map((topic) => {
            const active = selected.includes(topic)
            return (
              <button key={topic} type="button" aria-pressed={active}
                disabled={!active && selected.length >= 16}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm text-foreground hover:border-primary aria-pressed:border-primary/60 aria-pressed:bg-primary/10 aria-pressed:text-primary disabled:opacity-50"
                onClick={() => setSelected(active ? selected.filter((item) => item !== topic) : [...selected, topic])}>
                {active && <Check size={14} aria-hidden />}
                {topic}
              </button>
            )
          })}
          {selected.filter((topic) => !topics.includes(topic)).map((topic) => (
            <button key={topic} type="button" aria-label={`Remove ${topic}`}
              className="flex items-center gap-2 rounded-full border border-primary/60 bg-primary/10 px-4 py-2 text-sm text-primary"
              onClick={() => setSelected(selected.filter((item) => item !== topic))}>
              {topic}<X size={14} aria-hidden />
            </button>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="custom-interest" className="mb-2 block text-sm text-foreground">Add your own interest</label>
        <div className="flex gap-2">
          <input id="custom-interest" placeholder="e.g. Indie game development" maxLength={80}
            className="min-w-0 flex-1 rounded-lg border border-border bg-card px-4 py-2.5 text-sm"
            value={custom} disabled={busy} onChange={(event) => setCustom(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                addCustom()
              }
            }} />
          <button type="button" aria-label="Add interest" onClick={addCustom}
            disabled={busy || !custom.trim() || selected.length >= 16}
            className="rounded-lg border border-border px-3 hover:border-primary disabled:opacity-50">
            <Plus size={18} aria-hidden />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        <p aria-live="polite" className="text-sm text-muted-foreground">{selected.length} of 16 selected</p>
        <button type="submit" disabled={!selected.length || busy}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {busy ? 'Saving…' : label}<ArrowRight size={16} aria-hidden />
        </button>
      </div>
    </form>
  )
}
