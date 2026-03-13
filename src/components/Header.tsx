import { Link } from '@tanstack/react-router'
import ThemeToggle from './ThemeToggle'

export default function Header() {
  return (
    <header className="site-header">
      <nav className="page-wrap site-nav">
        <Link to="/" className="site-brand">
          <span className="site-brand-mark" aria-hidden="true" />
          <span>Yu-Gi-Oh Tools</span>
        </Link>

        <div className="site-links">
          <Link
            to="/"
            className="site-link"
            activeProps={{ className: 'site-link is-active' }}
          >
            Deck Viewer
          </Link>
          <Link
            to="/about"
            className="site-link"
            activeProps={{ className: 'site-link is-active' }}
          >
            About
          </Link>
        </div>

        <ThemeToggle />
      </nav>
    </header>
  )
}
