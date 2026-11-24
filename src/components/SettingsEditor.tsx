import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function SettingsEditor({ title, description, children }: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="min-h-full bg-background px-5 py-10 text-foreground sm:px-8 sm:py-16">
      <div className="mx-auto max-w-2xl">
        <Link to="/settings" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
          <ArrowLeft size={16} aria-hidden /> All settings
        </Link>
        <h1 className="mt-4 font-newsreader text-4xl tracking-tight sm:text-5xl">{title}</h1>
        <p className="mb-7 mt-2 text-muted-foreground">{description}</p>
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-8">{children}</div>
      </div>
    </section>
  )
}
