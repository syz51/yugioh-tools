import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  component: About,
})

function About() {
  return (
    <main className="page-wrap about-page">
      <section className="panel">
        <div className="panel-header">
          <div>
            <h1>About</h1>
            <p>
              This project is focused on practical Yu-Gi-Oh deck tooling. The
              current homepage is a deck viewer built around YDK imports.
            </p>
          </div>
        </div>

        <div className="about-copy">
          <p>
            Upload a simulator-exported <code>.ydk</code> file, or paste the raw
            text directly into the viewer.
          </p>
          <p>
            The parser reads the standard <code>#main</code>,{' '}
            <code>#extra</code>, and <code>!side</code> sections, then resolves
            card metadata from a Postgres cache, falling back to the{' '}
            <a href="https://ygocdb.com/api" target="_blank" rel="noreferrer">
              YGOCDB API
            </a>
            .
          </p>
          <p>
            Any malformed lines are surfaced as warnings so the deck can still
            render when possible.
          </p>
        </div>
      </section>
    </main>
  )
}
