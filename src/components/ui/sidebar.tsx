// Adapted from Aceternity UI's Sidebar registry component.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from './Dialog'

const SidebarContext = createContext<{
  expanded: boolean
  mobileOpen: boolean
  setMobileOpen: (open: boolean) => void
  collapse: () => void
  toggle: () => void
  setHovered: (hovered: boolean) => void
} | null>(null)

export function useSidebar() {
  const sidebar = useContext(SidebarContext)
  if (!sidebar) throw new Error('Sidebar controls require a Sidebar provider.')
  return sidebar
}

export function Sidebar({ children }: { children: ReactNode }) {
  const [pinned, setPinned] = useState(true)
  const [hovered, setHovered] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  useEffect(() => {
    if (!mobileOpen) return
    const desktop = window.matchMedia('(min-width: 48rem)')
    const closeOnDesktop = () => { if (desktop.matches) setMobileOpen(false) }
    closeOnDesktop()
    desktop.addEventListener('change', closeOnDesktop)
    return () => desktop.removeEventListener('change', closeOnDesktop)
  }, [mobileOpen])

  return (
    <SidebarContext.Provider value={{
      expanded: pinned || hovered,
      mobileOpen,
      setMobileOpen,
      setHovered,
      collapse: () => {
        setPinned(false)
        setHovered(false)
        setMobileOpen(false)
      },
      toggle: () => {
        setPinned(!(pinned || hovered))
        setHovered(false)
      },
    }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function SidebarBody({ children }: { children: ReactNode }) {
  const { expanded, setHovered, toggle, mobileOpen, setMobileOpen } = useSidebar()
  const reduceMotion = useReducedMotion()
  return (
    <>
      <motion.aside
        initial={false}
        animate={{ width: expanded ? 264 : 64 }}
        transition={{ duration: reduceMotion ? 0 : 0.18, ease: 'easeOut' }}
        onPointerEnter={(event) => { if (event.pointerType === 'mouse') setHovered(true) }}
        onPointerLeave={() => setHovered(false)}
        className="group/sidebar relative z-10 hidden h-full shrink-0 flex-col border-r border-border bg-card md:flex"
        data-expanded={expanded}
      >
        <div className={cn('flex h-16 shrink-0 items-center gap-2 border-b border-border px-3', !expanded && 'justify-center')}>
          {expanded && <span className="min-w-0 flex-1 truncate text-2xl font-semibold tracking-[-0.055em] text-black">signal.</span>}
          <button type="button" onClick={toggle} className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-primary"
            aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'} aria-expanded={expanded}>
            {expanded ? <PanelLeftClose size={18} aria-hidden /> : <PanelLeftOpen size={18} aria-hidden />}
          </button>
        </div>
        {children}
      </motion.aside>
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4 md:hidden">
        <span className="text-2xl font-semibold tracking-[-0.055em] text-black">signal.</span>
        <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
          <DialogTrigger render={
            <button type="button" aria-label="Open navigation"
              className="grid size-10 place-items-center rounded-lg text-foreground hover:bg-accent">
              <Menu size={20} aria-hidden />
            </button>
          } />
          <DialogContent className="!left-0 !top-0 !h-dvh !w-[min(20rem,90vw)] !max-w-none !translate-x-0 !translate-y-0 !flex !flex-col !gap-0 !rounded-none !border-0 !border-r !p-0">
            <DialogTitle className="flex h-16 shrink-0 items-center border-b border-border px-5 text-2xl font-semibold tracking-[-0.055em] text-black">
              <span aria-hidden="true">signal.</span>
              <span className="sr-only">App navigation</span>
            </DialogTitle>
            {children}
          </DialogContent>
        </Dialog>
      </div>
    </>
  )
}

export function SidebarLink({ to, label, icon }: { to: string; label: string; icon: ReactNode }) {
  const { collapse } = useSidebar()
  return (
    <NavLink to={to} aria-label={label} title={label} onClick={collapse}
      className={({ isActive }) => cn(
        'flex min-h-13 items-center gap-3 rounded-lg px-3 text-lg font-semibold',
        'group-data-[expanded=false]/sidebar:justify-center group-data-[expanded=false]/sidebar:px-0',
        isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}>
      <span aria-hidden="true" className="shrink-0">{icon}</span>
      <span className="truncate group-data-[expanded=false]/sidebar:hidden">{label}</span>
    </NavLink>
  )
}
