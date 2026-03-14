import { Link } from '@tanstack/react-router'
import ThemeToggle from './ThemeToggle'

export default function Header() {
  return (
    <header className="site-header">
      <nav className="page-wrap site-nav">
        <Link to="/" className="site-brand">
          <span className="site-brand-mark" aria-hidden="true" />
          <span>游戏王工具</span>
        </Link>

        <div className="site-links">
          <Link
            to="/"
            className="site-link"
            activeProps={{ className: 'site-link is-active' }}
          >
            卡组查看
          </Link>
        </div>

        <ThemeToggle />
      </nav>
    </header>
  )
}
