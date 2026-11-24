import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, House } from 'lucide-react'
import { Link } from 'react-router-dom'
import { LimelightNav, type NavItem } from './ui/limelight-nav'

const sections: NavItem[] = [
  { id: 'home', href: '#home', label: 'Home', icon: <House /> },
  { id: 'try-it-yourself', href: '#try-it-yourself', label: 'Try it yourself', icon: <ArrowUpRight /> },
]

export default function LandingNav() {
  const headerRef = useRef<HTMLElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    const targets = sections.map(({ id }) => document.getElementById(String(id)))
    let frame = 0

    function update() {
      const threshold = (headerRef.current?.getBoundingClientRect().bottom ?? 0) + 48
      const index = targets.reduce(
        (active, target, index) => target && target.getBoundingClientRect().top <= threshold ? index : active,
        0,
      )
      const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
      setActiveIndex(atEnd ? sections.length - 1 : index)
    }

    function scheduleUpdate() {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', scheduleUpdate, { passive: true })
    window.addEventListener('resize', scheduleUpdate)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', scheduleUpdate)
      window.removeEventListener('resize', scheduleUpdate)
    }
  }, [])

  return (
    <header ref={headerRef} className="landing-header pointer-events-none sticky z-30 flex justify-center px-2">
      <div className="pointer-events-auto inline-flex max-w-full items-center rounded-full border border-border bg-card px-1 shadow-sm sm:px-2">
        <LimelightNav
          items={sections}
          activeIndex={activeIndex}
          className="landing-nav-links rounded-full border-0 bg-transparent"
          iconContainerClassName="min-h-12 rounded-full px-2 text-xs sm:min-h-14 sm:px-5 sm:text-base"
        />
        <Link to="/home" className="shrink-0 border-l border-border px-2 py-1 text-xs font-semibold text-primary underline-offset-4 hover:underline sm:px-5 sm:text-base">
          Sign in
        </Link>
      </div>
    </header>
  )
}
