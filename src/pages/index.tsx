import { ArrowUpRight, AudioLines, BookOpen, Compass } from 'lucide-react'
import { Link } from 'react-router-dom'
import LandingIntro from '../components/LandingIntro'
import LandingNav from '../components/LandingNav'
import LandingStory from '../components/LandingStory'
import { Seo } from '../components/Seo'
import { seo } from '../seo'

export default function Landing() {
  return (
    <>
      <Seo {...seo} path="/" />
      <div id="home" data-testid="static-landing" className="landing-page flow-root min-h-svh bg-signal-paper text-signal-ink">
        <LandingNav />

        <main>
          <LandingIntro />

          <LandingStory />

          <section id="try-it-yourself" aria-labelledby="features-heading" className="mx-auto max-w-6xl px-6 pb-14 pt-20 sm:px-10 sm:pb-20 sm:pt-28 lg:pt-32">
            <h2 id="features-heading" className="landing-section-heading mx-auto max-w-3xl text-center">
              What you follow shapes what you get.
            </h2>
            <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-3">
              <article className="bg-card p-6 sm:p-8">
                <Compass size={22} className="text-primary" aria-hidden="true" />
                <h3 className="mt-4 text-lg font-semibold">A feed built around your interests</h3>
                <p className="mt-2 leading-relaxed text-muted-foreground">
                  Pick topics or describe something specific you’re curious about. Signal searches for recent coverage across the web.
                </p>
              </article>
              <article className="bg-card p-6 sm:p-8">
                <BookOpen size={22} className="text-primary" aria-hidden="true" />
                <h3 className="mt-4 text-lg font-semibold">AI-written stories with citations</h3>
                <p className="mt-2 leading-relaxed text-muted-foreground">
                  Signal brings the findings together in an article with links to the original sources, so you can dig deeper or check a claim.
                </p>
              </article>
              <article className="bg-card p-6 sm:p-8">
                <AudioLines size={22} className="text-primary" aria-hidden="true" />
                <h3 className="mt-4 text-lg font-semibold">A daily briefing you can listen to</h3>
                <p className="mt-2 leading-relaxed text-muted-foreground">
                  Signal turns those stories into a short personal podcast, with a transcript and links back to the reporting.
                </p>
              </article>
            </div>
            <div className="mt-9 flex flex-col items-center text-center sm:mt-12">
              <p className="font-newsreader text-2xl text-signal-ink sm:text-3xl">Start with what makes you curious.</p>
              <Link
                to="/sign-in"
                className="mt-7 inline-flex items-center gap-3 rounded-full bg-signal-green px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-900"
              >
                Choose your interests
                <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </section>
        </main>
        <footer className="border-t border-signal-border bg-[#EAEFE8]">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:gap-10 sm:px-10">
            <div className="flex shrink-0 items-baseline gap-3">
              <p className="landing-wordmark text-2xl">signal.</p>
              <p className="font-mono text-xs tracking-[0.12em] text-signal-ink/65">© 2026</p>
            </div>
            <div className="max-w-sm text-sm leading-relaxed text-signal-ink/75">
              <p>Signal uses AI to summarize reporting. It can miss context or make mistakes. Check the original sources before relying on a claim.</p>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}
