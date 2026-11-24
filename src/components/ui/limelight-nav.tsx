import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Bell, Compass, House } from 'lucide-react'
import { cn } from '@/lib/utils'

export type NavItem = {
  id: string | number
  icon: ReactNode
  label: string
  href?: string
  onClick?: () => void
}

const defaultNavItems: NavItem[] = [
  { id: 'default-home', icon: <House />, label: 'Home' },
  { id: 'default-explore', icon: <Compass />, label: 'Explore' },
  { id: 'default-notifications', icon: <Bell />, label: 'Notifications' },
]

type LimelightNavProps = {
  items?: NavItem[]
  activeIndex?: number
  defaultActiveIndex?: number
  onTabChange?: (index: number) => void
  className?: string
  limelightClassName?: string
  iconContainerClassName?: string
  iconClassName?: string
}

export function LimelightNav({
  items = defaultNavItems,
  activeIndex,
  defaultActiveIndex = 0,
  onTabChange,
  className,
  limelightClassName,
  iconContainerClassName,
  iconClassName,
}: LimelightNavProps) {
  const [selected, setSelected] = useState(defaultActiveIndex)
  const current = activeIndex ?? selected
  const navRef = useRef<HTMLElement>(null)
  const limelightRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const nav = navRef.current
    const light = limelightRef.current
    const item = nav?.querySelector<HTMLElement>('[data-current]')
    if (!nav || !light || !item) return

    function position() {
      if (!item || !light) return
      const center = item.offsetLeft + item.offsetWidth / 2
      light.style.transform = `translateX(${center - light.offsetWidth / 2}px)`
      light.style.opacity = '1'
    }
    position()

    const observer = new ResizeObserver(position)
    observer.observe(nav)
    nav.querySelectorAll('[data-nav-item]').forEach((link) => observer.observe(link))
    return () => observer.disconnect()
  }, [current, items])

  if (!items.length) return null

  return (
    <nav ref={navRef} aria-label="Page sections" className={cn(
      'relative inline-flex items-center rounded-xl border border-border bg-card px-0.5 sm:px-1',
      className,
    )}>
      {items.map(({ id, icon, label, href, onClick }, index) => {
        const isCurrent = current === index
        const classes = cn(
          'relative z-10 flex min-h-11 items-center gap-1 whitespace-nowrap rounded-lg px-1.5 text-xs font-semibold sm:gap-2 sm:px-4 sm:text-sm',
          'focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-primary',
          isCurrent ? 'text-primary' : 'text-foreground hover:text-primary',
          iconContainerClassName,
        )
        const handleClick = () => {
          setSelected(index)
          onTabChange?.(index)
          onClick?.()
        }
        const content = (
          <>
            <span aria-hidden="true" className={cn('hidden shrink-0 [&>svg]:size-4 min-[390px]:inline-flex', iconClassName)}>{icon}</span>
            {label}
          </>
        )

        return href ? (
          <a key={id} href={href} data-nav-item data-current={isCurrent || undefined}
            aria-current={isCurrent ? 'location' : undefined} className={classes} onClick={handleClick}>
            {content}
          </a>
        ) : (
          <button key={id} type="button" data-nav-item data-current={isCurrent || undefined}
            aria-pressed={isCurrent} className={classes} onClick={handleClick}>
            {content}
          </button>
        )
      })}
      <div ref={limelightRef} aria-hidden="true" className={cn(
        'pointer-events-none absolute left-0 top-0 h-[3px] w-8 rounded-full bg-primary opacity-0',
        'motion-safe:transition-transform motion-safe:duration-300',
        limelightClassName,
      )}>
        <div className="absolute left-[-30%] top-[3px] h-9 w-[160%] bg-gradient-to-b from-primary/15 to-transparent [clip-path:polygon(5%_100%,25%_0,75%_0,95%_100%)]" />
      </div>
    </nav>
  )
}
