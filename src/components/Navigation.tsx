import { Link } from 'react-router-dom'

export default function Navigation() {
  return (
    <nav data-testid="app-navigation" aria-label="Signal" className="border-b border-border bg-background">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4">
        <Link to="/" className="text-xl font-semibold tracking-[-0.055em] text-black">signal.</Link>
        <Link to="/sign-in" data-testid="nav-sign-in-button"
          className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
          Sign in
        </Link>
      </div>
    </nav>
  )
}
