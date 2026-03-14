import { Link } from '@tanstack/react-router'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useId } from 'react'
import { ConfigHero, RateBoard, StarterCountPanel } from './components/analysis-panels'
import { DeckSectionViewer } from './components/deck-section-viewer'
import { ImportGuidePanel, LandingDeckInput } from './components/import-panels'
import { useDeckWorkbench } from './hooks/use-deck-workbench'

export function StarterRateExperiencePage() {
  const model = useDeckWorkbench()
  const inputId = useId()
  const shouldReduceMotion = useReducedMotion()

  return (
    <main className={`experience-shell stage-${model.stage}`}>
      <section className="experience-topbar">
        <Link className="experience-brand" to="/">
          <span className="experience-brand-mark" aria-hidden="true" />
          <span>游戏王启动率计算器</span>
        </Link>
      </section>

      <section className="experience-frame">
        <AnimatePresence mode="wait" initial={false}>
          {model.stage === 'landing' ? (
            <motion.div
              key="landing"
              className="experience-stage landing-stage"
              initial={
                shouldReduceMotion
                  ? { opacity: 1 }
                  : { opacity: 0, y: 22, scale: 0.985 }
              }
              animate={
                shouldReduceMotion
                  ? { opacity: 1 }
                  : { opacity: 1, y: 0, scale: 1 }
              }
              exit={
                shouldReduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: -18, scale: 1.01 }
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
          ) : (
            <motion.div
              key="config"
              className="experience-stage config-stage analysis-stage"
              initial={
                shouldReduceMotion
                  ? { opacity: 1 }
                  : { opacity: 0, x: 48, scale: 0.985 }
              }
              animate={
                shouldReduceMotion
                  ? { opacity: 1 }
                  : { opacity: 1, x: 0, scale: 1 }
              }
              exit={
                shouldReduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, x: -48, scale: 1.01 }
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
          )}
        </AnimatePresence>

        {!shouldReduceMotion ? (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`wipe-${model.stage}`}
              className="stage-wipe"
              initial={{ clipPath: 'inset(0 100% 0 0)', opacity: 0.95 }}
              animate={{
                clipPath: [
                  'inset(0 100% 0 0)',
                  'inset(0 0% 0 0)',
                  'inset(0 0% 0 100%)',
                ],
                opacity: [0.65, 0.95, 0],
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
            />
          </AnimatePresence>
        ) : null}
      </section>
    </main>
  )
}
