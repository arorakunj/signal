import { useEffect, useRef } from 'react'
import { AudioLines, BookOpen, Link2, Play } from 'lucide-react'

export default function LandingStory() {
  const storyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const story = storyRef.current
    const frame = story?.querySelector<HTMLElement>('.landing-story-frame')
    const mask = frame?.querySelector<HTMLElement>('.landing-story-mask')
    if (!story || !frame || !mask) return

    let disposed = false
    let revert: (() => void) | undefined

    async function animate() {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ])
      if (disposed || !story || !frame || !mask) return

      gsap.registerPlugin(ScrollTrigger)
      const media = gsap.matchMedia()
      revert = () => media.revert()

      media.add('(prefers-reduced-motion: no-preference)', () => {
        story.dataset.motion = 'active'
        const panel = '[data-story-panel]'
        const coast = '[data-story-scene="coast"]'
        const observatory = '[data-story-scene="observatory"]'
        const isCompact = () => window.innerWidth < 640

        gsap.set(observatory, { opacity: 0 })
        const timeline = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            trigger: frame,
            start: 'top top',
            end: () => `+=${Math.round(frame.clientHeight * (isCompact() ? 2 : 2.6))}`,
            pin: true,
            scrub: 0.35,
            invalidateOnRefresh: true,
          },
        })

        // Keep the crop off the element ScrollTrigger switches between flow and fixed positioning.
        gsap.fromTo(mask, {
          clipPath: () => isCompact() ? 'inset(0% 4% 9% 4% round 20px)' : 'inset(0% 8% 12% 8% round 32px)',
        }, {
          clipPath: 'inset(-0.35% 0% -0.35% 0% round 0px)',
          ease: 'none',
          scrollTrigger: {
            trigger: story,
            start: 'top 45%',
            end: 'top top',
            scrub: true,
            invalidateOnRefresh: true,
          },
        })

        timeline
          .fromTo(`${coast} img`, { yPercent: -4, scale: 1.16 }, { yPercent: 4, scale: 1.12, duration: 5.4 }, 0)
          .from(`${coast} [data-story-copy]`, { opacity: 0, y: 32, stagger: 0.22, duration: 0.65 }, 0.6)
          .from(`${coast} ${panel}`, { opacity: 0, y: 52, stagger: 0.48, duration: 0.85 }, 1.3)
          .to(`${coast} ${panel}, ${coast} [data-story-copy]`, { opacity: 0, y: -22, duration: 0.5 }, 3.7)
          .to(observatory, { opacity: 1, duration: 1.05 }, 3.85)
          .fromTo(`${observatory} img`, { yPercent: 4, scale: 1.14 }, { yPercent: -3, scale: 1.1, duration: 3.8 }, 3.85)
          .from(`${observatory} [data-story-copy]`, { opacity: 0, y: 28, stagger: 0.24, duration: 0.7 }, 4.65)
          .from(`${observatory} ${panel}`, { opacity: 0, y: 44, duration: 0.85 }, 5.5)

        // A section link can be followed before the lazy animation adds pin spacing.
        const alignAnchor = requestAnimationFrame(() => {
          const anchor = window.location.hash.slice(1)
          const target = document.getElementById(anchor)
          if (!target || anchor === 'home' || !story.closest('.landing-page')?.contains(target)) return
          ScrollTrigger.refresh()
          target.scrollIntoView({ block: 'start', behavior: 'instant' })
        })

        return () => {
          cancelAnimationFrame(alignAnchor)
          delete story.dataset.motion
        }
      }, story)
    }

    void animate().catch(() => revert?.())
    return () => {
      disposed = true
      revert?.()
    }
  }, [])

  return (
    <div ref={storyRef} className="landing-story" aria-label="A preview of Signal">
      <div className="landing-story-frame">
        <div className="landing-story-mask">
          <section data-story-scene="coast" className="landing-story-scene">
            <img src="/images/signal-coast.jpg"
              srcSet="/images/signal-coast-840.jpg 840w, /images/signal-coast.jpg 1680w"
              sizes="100vw" width={1680} height={1120} alt="" fetchPriority="high" decoding="async" />
            <div className="landing-story-layout">
              <div className="landing-story-headline">
                <h2 data-story-copy>Follow a question.</h2>
                <p data-story-copy>Signal searches recent coverage on the topics you follow and brings it together in stories with linked sources.</p>
              </div>

              <div className="landing-story-previews">
                <article data-story-panel className="landing-story-card landing-story-article">
                  <div className="landing-story-label"><BookOpen size={15} aria-hidden="true" /> Article preview</div>
                  <h3>How do satellites help us read the ocean?</h3>
                  <p>A closer look at the science behind the view from above.</p>
                </article>
                <aside data-story-panel className="landing-story-card landing-story-sources">
                  <div className="landing-story-label"><Link2 size={15} aria-hidden="true" /> Citation preview</div>
                  <p>Original reporting</p>
                  <p>Research and supporting evidence</p>
                </aside>
              </div>
            </div>
          </section>

          <section data-story-scene="observatory" className="landing-story-scene">
            <img src="/images/signal-observatory.jpg"
              srcSet="/images/signal-observatory-840.jpg 840w, /images/signal-observatory.jpg 1680w"
              sizes="100vw" width={1680} height={1120} alt="" loading="lazy" decoding="async" />
            <div className="landing-story-layout">
              <div className="landing-story-headline">
                <h2 data-story-copy>Take curiosity with you.</h2>
                <p data-story-copy>Your articles become a short daily podcast with a transcript, so you can listen and come back to the sources.</p>
              </div>

              <div className="landing-story-previews">
                <div data-story-panel className="landing-story-card landing-story-player">
                  <div className="landing-story-label"><AudioLines size={16} aria-hidden="true" /> Podcast preview</div>
                  <h3>Your daily briefing</h3>
                  <div className="landing-story-player-track" aria-hidden="true">
                    <span className="landing-story-play"><Play size={15} fill="currentColor" /></span>
                    <span className="landing-story-progress" />
                    <span>4:12</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
