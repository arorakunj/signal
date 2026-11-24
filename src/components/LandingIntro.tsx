import { useCallback, useEffect, useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { Link } from 'react-router-dom'
import TextTypewriter from './ui/the-typewriter'

let introPlayed = false

export default function LandingIntro() {
  const [play, setPlay] = useState(false)
  const [copyReady, setCopyReady] = useState(false)
  const reducedMotion = useReducedMotion()
  const showCopy = !play || reducedMotion || copyReady
  const revealCopy = useCallback(() => setCopyReady(true), [])

  useEffect(() => {
    if (introPlayed) return
    const frame = requestAnimationFrame(() => {
      introPlayed = true
      const navigation = performance.getEntriesByType('navigation')[0]
      const cameFromLanding = !navigation || new URL(navigation.name).pathname === '/'
      if (cameFromLanding && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setPlay(true)
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <section className="flex flex-col items-center px-6 pb-8 pt-6 text-center sm:pb-10 sm:pt-10">
      <h1 className="landing-wordmark text-[clamp(5rem,13vw,10rem)] leading-[0.85]">
        <TextTypewriter play={play} duration={0.65}>signal.</TextTypewriter>
      </h1>
      <p className="mt-6 max-w-full font-newsreader text-[clamp(1.8rem,5vw,3.75rem)] italic leading-tight tracking-tight sm:mt-8">
        <TextTypewriter play={play} duration={1.6} delay={0.78} onComplete={revealCopy}>
          Stay curious. Stay informed.
        </TextTypewriter>
      </p>
      <p
        data-intro-copy
        className={`mt-4 max-w-md text-base leading-relaxed text-signal-muted sm:text-lg ${showCopy ? 'opacity-100 motion-safe:transition-opacity motion-safe:duration-700' : 'opacity-0'}`}
      >
        Source-backed stories and a daily podcast about the topics you care about.
      </p>
      <Link
        to="/home"
        className="mt-8 inline-flex items-center gap-3 rounded-full bg-signal-green px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-900"
      >
        Choose your interests
        <ArrowUpRight size={16} aria-hidden="true" />
      </Link>
    </section>
  )
}
