import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import AppPage from './AppPage'

export default function SettingsEditor({ title, description, children }: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <AppPage title={title} description={description}>
      <Link to="/settings" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
        <ArrowLeft size={16} aria-hidden /> All settings
      </Link>
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-8">{children}</div>
    </AppPage>
  )
}
