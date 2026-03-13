import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  component: About,
})

function About() {
  return (
    <main className="about-shell">
      <section className="about-panel">
        <div className="about-copy">
          <p className="panel-kicker">About this prototype</p>
          <h1>One focused starter-rate experience sits on the home route.</h1>
          <p>
            The current pass focuses on YDK import plus one-card starter
            selection. The calculation logic stays intact; the interface was
            rebuilt around a darker, warmer, game-first presentation.
          </p>
        </div>
        <div className="about-actions">
          <Link className="primary-button" to="/">
            Back to starter board
          </Link>
        </div>
      </section>
    </main>
  )
}
