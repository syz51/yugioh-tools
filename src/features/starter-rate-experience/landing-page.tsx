import { motion, useReducedMotion } from 'framer-motion'
import { useId } from 'react'
import { ExperienceShell } from './components/experience-shell'
import { ImportGuidePanel, LandingDeckInput } from './components/import-panels'
import { useDeckImport } from './hooks/use-deck-import'

export function StarterRateLandingPage() {
  const model = useDeckImport()
  const inputId = useId()
  const shouldReduceMotion = useReducedMotion()

  return (
    <ExperienceShell stageClassName="stage-landing">
      <motion.div
        className="experience-stage landing-stage"
        initial={
          shouldReduceMotion
            ? { opacity: 1 }
            : { opacity: 0, y: 22, scale: 0.985 }
        }
        animate={
          shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }
        }
        transition={{
          duration: shouldReduceMotion ? 0.12 : 0.42,
          ease: 'easeOut',
        }}
      >
        <div className="landing-grid">
          <ImportGuidePanel />
          <div className="landing-right-rail">
            <LandingDeckInput inputId={inputId} model={model} />
          </div>
        </div>
      </motion.div>
    </ExperienceShell>
  )
}
