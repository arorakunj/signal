import BriefingPanel from '@/components/BriefingPanel'

export default function Podcasts() {
  return (
    <section className="min-h-full bg-background px-6 py-16 text-foreground">
      <div className="mx-auto max-w-5xl">
        <h1 className="font-newsreader text-5xl tracking-tight">Podcasts</h1>
        <BriefingPanel kind="podcast" />
      </div>
    </section>
  )
}
