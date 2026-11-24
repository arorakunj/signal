import type { ReactNode } from 'react'

export default function AppPage({ title, description, children }: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="min-h-full bg-background px-5 py-10 text-foreground sm:px-8 sm:py-16">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 border-b border-border pb-6">
          <h1 className="font-newsreader text-4xl tracking-tight sm:text-5xl">{title}</h1>
          {description && <p className="mt-2 text-muted-foreground">{description}</p>}
        </header>
        {children}
      </div>
    </section>
  )
}
