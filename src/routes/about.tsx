import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  component: About,
})

function About() {
  return (
    <main className="page-wrap px-4 py-12">
      <section className="island-shell rounded-2xl p-6 sm:p-8">
        <h1 className="mb-3 text-3xl font-semibold text-[var(--sea-ink)] sm:text-4xl">
          About this calculator
        </h1>
        <div className="space-y-4 text-base leading-8 text-[var(--sea-ink-soft)]">
          <p className="m-0">
            The home page models an opening hand as disjoint card pools plus
            unnamed filler. That lets the app calculate exact multivariate
            hypergeometric odds instead of relying on simulation.
          </p>
          <p className="m-0">
            One-card starters are handled automatically. Multi-card lines are
            described as recipes over your combo pools, and optional draw cards
            can extend the opener before the final success check is made.
          </p>
          <p className="m-0">
            Keep each real card in exactly one pool if you want the result to
            stay exact. If two starter lines share the same card, model that
            card once and reference the same pool in both recipes.
          </p>
        </div>
      </section>
    </main>
  )
}
