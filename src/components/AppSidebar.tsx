import { useEffect } from 'react'
import { useAsyncResource, useAuthProfileReady, signOut } from 'deepspace'
import { AudioLines, ChevronUp, LayoutGrid, LogOut, Settings } from 'lucide-react'
import type { Role } from '../constants'
import { nav } from '../nav'
import { getProfileDetails, PROFILE_UPDATED } from '@/lib/profile'
import {
  Avatar, AvatarFallback, AvatarImage, DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from './ui'
import { Sidebar, SidebarBody, SidebarLink } from './ui/sidebar'

const icons = { '/feed': LayoutGrid, '/podcasts': AudioLines, '/settings': Settings }

export default function AppSidebar() {
  const { user, userLoading } = useAuthProfileReady({ requireUser: true })
  const profile = useAsyncResource(getProfileDetails, [], { keepPreviousData: true })
  const { reload } = profile
  useEffect(() => {
    window.addEventListener(PROFILE_UPDATED, reload)
    return () => window.removeEventListener(PROFILE_UPDATED, reload)
  }, [reload])
  const name = profile.data?.displayName || user?.name || user?.email || 'Account'
  const role = user?.role as Role | undefined
  const items = nav.filter((item) => (
    (!item.devOnly || import.meta.env.DEV) &&
    (!item.roles || role === 'admin' || (role && item.roles.includes(role)))
  ))

  return (
    <Sidebar>
      <SidebarBody>
        <nav data-testid="app-navigation" aria-label="App navigation" className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3 pt-5">
          {items.map(({ path, label }) => {
            const Icon = icons[path as keyof typeof icons] ?? LayoutGrid
            return <SidebarLink key={path} to={path} label={label} icon={<Icon size={21} />} />
          })}
        </nav>
        <div className="shrink-0 border-t border-border p-3">
          {userLoading ? (
            <div aria-label="Loading account" className="size-8 rounded-full bg-muted motion-safe:animate-pulse" />
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger render={
                <button type="button" aria-label="Account menu"
                  className="flex w-full items-center gap-2 rounded-lg p-1 text-left hover:bg-accent">
                  <Avatar className="size-8 shrink-0">
                    <AvatarImage src={user?.imageUrl ?? undefined} referrerPolicy="no-referrer" />
                    <AvatarFallback>{name.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span data-testid="nav-user-name" className="min-w-0 flex-1 truncate text-base font-semibold group-data-[expanded=false]/sidebar:hidden">
                    {name}
                  </span>
                  <ChevronUp size={15} aria-hidden className="shrink-0 text-muted-foreground group-data-[expanded=false]/sidebar:hidden" />
                </button>
              } />
              <DropdownMenuContent side="top" align="start" className="w-56">
                <DropdownMenuLabel>
                  <div className="truncate font-medium">{name}</div>
                  <div data-testid="nav-user-email" className="truncate text-xs font-normal text-muted-foreground">{user?.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void signOut()}><LogOut aria-hidden /> Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </SidebarBody>
    </Sidebar>
  )
}
