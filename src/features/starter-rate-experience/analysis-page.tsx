import { motion, useReducedMotion } from 'framer-motion'
import { ConfigHero, RateBoard, StarterCountPanel } from './components/analysis-panels'
import { DeckSectionViewer } from './components/deck-section-viewer'
import { ExperienceShell } from './components/experience-shell'
import type { DeckAnalysisModel } from './types'

export function StarterRateAnalysisPage({
  model,
}: {
  model: DeckAnalysisModel
}) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <ExperienceShell stageClassName="stage-config">
      <motion.div
        className="experience-stage config-stage analysis-stage"
        initial={
          shouldReduceMotion
            ? { opacity: 1 }
            : { opacity: 0, x: 48, scale: 0.985 }
        }
        animate={
          shouldReduceMotion ? { opacity: 1 } : { opacity: 1, x: 0, scale: 1 }
        }
        transition={{
          duration: shouldReduceMotion ? 0.12 : 0.44,
          ease: 'easeOut',
        }}
      >
        <ConfigHero model={model} />
        <div className="analysis-grid">
          <section className="analysis-canvas">
            <StarterCountPanel model={model} />
            <DeckSectionViewer model={model} />
          </section>
          <aside className="analysis-output-stack">
            <RateBoard model={model} />
          </aside>
        </div>
      </motion.div>
    </ExperienceShell>
  )
}
