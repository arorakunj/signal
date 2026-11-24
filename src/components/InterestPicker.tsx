import { useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, Check, Plus, X } from 'lucide-react'
import { categories, focusSuggestions, type Category, type Interest } from '@/lib/interests'

export default function InterestPicker({
  initial = [], label, onSubmit, busy = false,
}: {
  initial?: Interest[]
  label: string
  onSubmit: (interests: Interest[]) => void
  busy?: boolean
}) {
  const [selected, setSelected] = useState(initial)
  const [step, setStep] = useState<'categories' | 'specifics'>('categories')
  const [drafts, setDrafts] = useState<Partial<Record<Category, string>>>({})
  const stepHeading = useRef<HTMLElement>(null)
  const moved = useRef(false)
  const setStepHeading = (node: HTMLElement | null) => { stepHeading.current = node }

  useLayoutEffect(() => {
    if (moved.current) stepHeading.current?.focus()
  }, [step])

  function changeStep(next: typeof step) {
    moved.current = true
    setStep(next)
  }

  function toggleCategory(category: Category) {
    setSelected((items) => items.some((item) => item.category === category)
      ? items.filter((item) => item.category !== category)
      : [...items, initial.find((item) => item.category === category) ?? { category, focus: [] }])
  }

  function addFocus(category: Category, value: string) {
    const term = value.trim()
    if (!term) return
    setSelected((items) => items.map((item) => item.category !== category ||
      item.focus.length >= 4 || item.focus.some((focus) => focus.toLowerCase() === term.toLowerCase())
      ? item
      : { ...item, focus: [...item.focus, term] }))
    setDrafts((inputs) => ({ ...inputs, [category]: '' }))
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || !selected.length) return
    if (step === 'categories') {
      changeStep('specifics')
      return
    }
    const interests = selected.map((item) => {
      const term = drafts[item.category]?.trim()
      return term && item.focus.length < 4 && !item.focus.some((focus) => focus.toLowerCase() === term.toLowerCase())
        ? { ...item, focus: [...item.focus, term] }
        : item
    })
    onSubmit(interests)
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {step === 'categories' ? (
        <fieldset disabled={busy}>
          <legend ref={setStepHeading} tabIndex={-1} className="mb-4 text-sm font-semibold">Pick your categories</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {categories.map((category) => {
              const active = selected.some((item) => item.category === category)
              return (
                <button key={category} type="button" aria-pressed={active} onClick={() => toggleCategory(category)}
                  className="flex min-h-12 items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-left text-sm font-semibold hover:border-primary aria-pressed:border-primary/60 aria-pressed:bg-primary/10 aria-pressed:text-primary sm:px-4">
                  {category}{active && <Check size={16} className="shrink-0" aria-hidden />}
                </button>
              )
            })}
          </div>
        </fieldset>
      ) : (
        <>
          <div>
            <h2 ref={setStepHeading} tabIndex={-1} className="font-newsreader text-3xl tracking-tight">Anything specific?</h2>
            <p className="mt-1 text-sm text-muted-foreground">Optional. Add up to four interests per category to see more coverage about them.</p>
          </div>
          {selected.map(({ category, focus }) => (
            <fieldset key={category} disabled={busy} className="space-y-3 border-t border-border pt-4">
              <legend className="pr-2 text-sm font-semibold">{category}</legend>
              <div className="flex flex-wrap gap-2">
                {focus.map((term) => (
                  <button key={term} type="button" aria-label={`Remove ${term}`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-sm text-primary"
                    onClick={() => setSelected((items) => items.map((item) => item.category === category
                      ? { ...item, focus: item.focus.filter((value) => value !== term) }
                      : item))}>
                    {term}<X size={14} aria-hidden />
                  </button>
                ))}
                {focusSuggestions[category].filter((term) => !focus.some((value) => value.toLowerCase() === term.toLowerCase())).map((term) => (
                  <button key={term} type="button" disabled={focus.length >= 4} onClick={() => addFocus(category, term)}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-sm hover:border-primary disabled:opacity-50">
                    <Plus size={14} aria-hidden />{term}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input aria-label={`Specific interest in ${category}`} placeholder="Add your own" maxLength={80}
                  className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
                  value={drafts[category] ?? ''} disabled={focus.length >= 4}
                  onChange={(event) => setDrafts({ ...drafts, [category]: event.target.value })}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      addFocus(category, drafts[category] ?? '')
                    }
                  }}
                />
                <button type="button" aria-label={`Add ${category} interest`}
                  disabled={!drafts[category]?.trim() || focus.length >= 4}
                  onClick={() => addFocus(category, drafts[category] ?? '')}
                  className="rounded-lg border border-border px-3 hover:border-primary disabled:opacity-50">
                  <Plus size={18} aria-hidden />
                </button>
              </div>
            </fieldset>
          ))}
        </>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        {step === 'categories'
          ? <p aria-live="polite" className="text-sm text-muted-foreground">{selected.length} selected</p>
          : <button type="button" disabled={busy} onClick={() => changeStep('categories')}
              className="inline-flex items-center gap-2 text-sm font-semibold text-primary"><ArrowLeft size={15} aria-hidden /> Back</button>}
        <button type="submit" disabled={!selected.length || busy}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {busy ? 'Saving…' : step === 'categories' ? 'Continue' : label}<ArrowRight size={16} aria-hidden />
        </button>
      </div>
    </form>
  )
}
