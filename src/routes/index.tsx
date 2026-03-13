import { useDeferredValue, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import type { OpeningHandCalculationInput } from '../lib/opening-hand-calculator'
import { calculateOpeningHandProbabilities } from '../lib/opening-hand-calculator'

export const Route = createFileRoute('/')({ component: App })

type ComboPoolForm = {
  id: string
  label: string
  copies: number
}

type ComboRecipeForm = {
  id: string
  label: string
  requirements: Record<string, number>
}

type DrawEffectForm = {
  id: string
  label: string
  copies: number
  drawsPerActivation: number
  maxActivations: number
}

type CalculatorFormState = {
  deckSize: number
  openingHandSize: number
  oneCardStarterCopies: number
  comboPools: ComboPoolForm[]
  comboRecipes: ComboRecipeForm[]
  drawEffects: DrawEffectForm[]
}

const DEFAULT_FORM_STATE: CalculatorFormState = {
  deckSize: 40,
  openingHandSize: 5,
  oneCardStarterCopies: 12,
  comboPools: [
    { id: 'discarders', label: 'Discarders', copies: 9 },
    { id: 'payoffs', label: 'Payoffs', copies: 6 },
  ],
  comboRecipes: [
    {
      id: 'discard-plus-payoff',
      label: 'Discarder + payoff',
      requirements: {
        discarders: 1,
        payoffs: 1,
      },
    },
  ],
  drawEffects: [
    {
      id: 'pot-of-extravagance',
      label: 'Pot of Extravagance',
      copies: 3,
      drawsPerActivation: 2,
      maxActivations: 1,
    },
  ],
}

function App() {
  const [formState, setFormState] = useState(DEFAULT_FORM_STATE)
  const deferredFormState = useDeferredValue(formState)

  const calculation = buildCalculationState(deferredFormState)
  const namedCards =
    deferredFormState.oneCardStarterCopies +
    deferredFormState.comboPools.reduce((sum, pool) => sum + pool.copies, 0) +
    deferredFormState.drawEffects.reduce((sum, pool) => sum + pool.copies, 0)
  const fillerCards = deferredFormState.deckSize - namedCards

  return (
    <main className="page-wrap px-4 pb-12 pt-8">
      <section className="calc-layout">
        <div className="calc-main">
          <section className="calc-panel">
            <h1 className="calc-title">Yu-Gi-Oh opening hand calculator</h1>
            <p className="calc-copy">
              Define disjoint card pools, then calculate the exact chance that
              your opening five can access any starter line. One-card starters,
              two-card combinations, three-card lines, and opening draw effects
              all use the same probability engine.
            </p>
          </section>

          <section className="calc-panel">
            <div className="calc-section-head">
              <h2>Deck settings</h2>
              <p>Everything else is measured against this deck list.</p>
            </div>
            <div className="calc-grid calc-grid-compact">
              <label className="calc-field">
                <span>Deck size</span>
                <input
                  className="calc-input"
                  type="number"
                  min={1}
                  value={formState.deckSize}
                  onChange={(event) => {
                    setFormState((current) => ({
                      ...current,
                      deckSize: readInteger(event.target.value),
                    }))
                  }}
                />
              </label>
              <label className="calc-field">
                <span>Opening hand size</span>
                <input
                  className="calc-input"
                  type="number"
                  min={1}
                  value={formState.openingHandSize}
                  onChange={(event) => {
                    setFormState((current) => ({
                      ...current,
                      openingHandSize: readInteger(event.target.value),
                    }))
                  }}
                />
              </label>
              <label className="calc-field">
                <span>One-card starters</span>
                <input
                  className="calc-input"
                  type="number"
                  min={0}
                  value={formState.oneCardStarterCopies}
                  onChange={(event) => {
                    setFormState((current) => ({
                      ...current,
                      oneCardStarterCopies: readInteger(event.target.value),
                    }))
                  }}
                />
              </label>
              <div className="calc-stat">
                <span>Unnamed filler cards</span>
                <strong>{fillerCards}</strong>
              </div>
            </div>
          </section>

          <section className="calc-panel">
            <div className="calc-section-head">
              <div>
                <h2>Combo pools</h2>
                <p>
                  Add the card groups used by your multi-card starter lines.
                  Keep these disjoint from the one-card starter count above.
                </p>
              </div>
              <button
                type="button"
                className="calc-button"
                onClick={() => {
                  const nextPoolId = createId('combo-pool')
                  setFormState((current) => ({
                    ...current,
                    comboPools: [
                      ...current.comboPools,
                      {
                        id: nextPoolId,
                        label: `Pool ${current.comboPools.length + 1}`,
                        copies: 0,
                      },
                    ],
                    comboRecipes: current.comboRecipes.map((recipe) => ({
                      ...recipe,
                      requirements: {
                        ...recipe.requirements,
                        [nextPoolId]: 0,
                      },
                    })),
                  }))
                }}
              >
                Add pool
              </button>
            </div>

            <div className="calc-stack">
              {formState.comboPools.length === 0 ? (
                <p className="calc-empty">No combo pools yet.</p>
              ) : (
                formState.comboPools.map((pool) => (
                  <div className="calc-row" key={pool.id}>
                    <label className="calc-field">
                      <span>Pool name</span>
                      <input
                        className="calc-input"
                        value={pool.label}
                        onChange={(event) => {
                          setFormState((current) => ({
                            ...current,
                            comboPools: current.comboPools.map((entry) =>
                              entry.id === pool.id
                                ? { ...entry, label: event.target.value }
                                : entry,
                            ),
                          }))
                        }}
                      />
                    </label>
                    <label className="calc-field calc-field-small">
                      <span>Copies</span>
                      <input
                        className="calc-input"
                        type="number"
                        min={0}
                        value={pool.copies}
                        onChange={(event) => {
                          setFormState((current) => ({
                            ...current,
                            comboPools: current.comboPools.map((entry) =>
                              entry.id === pool.id
                                ? { ...entry, copies: readInteger(event.target.value) }
                                : entry,
                            ),
                          }))
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className="calc-button calc-button-subtle"
                      onClick={() => {
                        setFormState((current) => ({
                          ...current,
                          comboPools: current.comboPools.filter(
                            (entry) => entry.id !== pool.id,
                          ),
                          comboRecipes: current.comboRecipes.map((recipe) => {
                            const nextRequirements = { ...recipe.requirements }
                            delete nextRequirements[pool.id]
                            return {
                              ...recipe,
                              requirements: nextRequirements,
                            }
                          }),
                        }))
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="calc-panel">
            <div className="calc-section-head">
              <div>
                <h2>Starter recipes</h2>
                <p>
                  Each row is one playable line. Enter how many cards from each
                  pool that line needs.
                </p>
              </div>
              <button
                type="button"
                className="calc-button"
                onClick={() => {
                  setFormState((current) => ({
                    ...current,
                    comboRecipes: [
                      ...current.comboRecipes,
                      {
                        id: createId('recipe'),
                        label: `Combo ${current.comboRecipes.length + 1}`,
                        requirements: Object.fromEntries(
                          current.comboPools.map((pool) => [pool.id, 0]),
                        ),
                      },
                    ],
                  }))
                }}
              >
                Add recipe
              </button>
            </div>

            {formState.comboRecipes.length === 0 ? (
              <p className="calc-empty">No multi-card lines yet.</p>
            ) : (
              <div className="calc-table-wrap">
                <table className="calc-table">
                  <thead>
                    <tr>
                      <th>Recipe</th>
                      {formState.comboPools.map((pool) => (
                        <th key={pool.id}>{pool.label}</th>
                      ))}
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {formState.comboRecipes.map((recipe) => (
                      <tr key={recipe.id}>
                        <td>
                          <input
                            className="calc-input"
                            value={recipe.label}
                            onChange={(event) => {
                              setFormState((current) => ({
                                ...current,
                                comboRecipes: current.comboRecipes.map((entry) =>
                                  entry.id === recipe.id
                                    ? { ...entry, label: event.target.value }
                                    : entry,
                                ),
                              }))
                            }}
                          />
                        </td>
                        {formState.comboPools.map((pool) => (
                          <td key={pool.id}>
                            <input
                              className="calc-input"
                              type="number"
                              min={0}
                              value={recipe.requirements[pool.id] ?? 0}
                              onChange={(event) => {
                                setFormState((current) => ({
                                  ...current,
                                  comboRecipes: current.comboRecipes.map((entry) =>
                                    entry.id === recipe.id
                                      ? {
                                          ...entry,
                                          requirements: {
                                            ...entry.requirements,
                                            [pool.id]: readInteger(event.target.value),
                                          },
                                        }
                                      : entry,
                                  ),
                                }))
                              }}
                            />
                          </td>
                        ))}
                        <td className="calc-table-action">
                          <button
                            type="button"
                            className="calc-button calc-button-subtle"
                            onClick={() => {
                              setFormState((current) => ({
                                ...current,
                                comboRecipes: current.comboRecipes.filter(
                                  (entry) => entry.id !== recipe.id,
                                ),
                              }))
                            }}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="calc-panel">
            <div className="calc-section-head">
              <div>
                <h2>Opening draw effects</h2>
                <p>
                  Use this for cards like Pot of Extravagance that let you see
                  extra cards before committing to your line.
                </p>
              </div>
              <button
                type="button"
                className="calc-button"
                onClick={() => {
                  setFormState((current) => ({
                    ...current,
                    drawEffects: [
                      ...current.drawEffects,
                      {
                        id: createId('draw-effect'),
                        label: `Draw effect ${current.drawEffects.length + 1}`,
                        copies: 0,
                        drawsPerActivation: 1,
                        maxActivations: 1,
                      },
                    ],
                  }))
                }}
              >
                Add draw card
              </button>
            </div>

            <div className="calc-stack">
              {formState.drawEffects.length === 0 ? (
                <p className="calc-empty">No draw effects yet.</p>
              ) : (
                formState.drawEffects.map((effect) => (
                  <div className="calc-row calc-row-dense" key={effect.id}>
                    <label className="calc-field">
                      <span>Name</span>
                      <input
                        className="calc-input"
                        value={effect.label}
                        onChange={(event) => {
                          setFormState((current) => ({
                            ...current,
                            drawEffects: current.drawEffects.map((entry) =>
                              entry.id === effect.id
                                ? { ...entry, label: event.target.value }
                                : entry,
                            ),
                          }))
                        }}
                      />
                    </label>
                    <label className="calc-field calc-field-small">
                      <span>Copies</span>
                      <input
                        className="calc-input"
                        type="number"
                        min={0}
                        value={effect.copies}
                        onChange={(event) => {
                          setFormState((current) => ({
                            ...current,
                            drawEffects: current.drawEffects.map((entry) =>
                              entry.id === effect.id
                                ? { ...entry, copies: readInteger(event.target.value) }
                                : entry,
                            ),
                          }))
                        }}
                      />
                    </label>
                    <label className="calc-field calc-field-small">
                      <span>Cards drawn</span>
                      <input
                        className="calc-input"
                        type="number"
                        min={1}
                        value={effect.drawsPerActivation}
                        onChange={(event) => {
                          setFormState((current) => ({
                            ...current,
                            drawEffects: current.drawEffects.map((entry) =>
                              entry.id === effect.id
                                ? {
                                    ...entry,
                                    drawsPerActivation: readInteger(event.target.value),
                                  }
                                : entry,
                            ),
                          }))
                        }}
                      />
                    </label>
                    <label className="calc-field calc-field-small">
                      <span>Max uses</span>
                      <input
                        className="calc-input"
                        type="number"
                        min={1}
                        value={effect.maxActivations}
                        onChange={(event) => {
                          setFormState((current) => ({
                            ...current,
                            drawEffects: current.drawEffects.map((entry) =>
                              entry.id === effect.id
                                ? {
                                    ...entry,
                                    maxActivations: readInteger(event.target.value),
                                  }
                                : entry,
                            ),
                          }))
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className="calc-button calc-button-subtle"
                      onClick={() => {
                        setFormState((current) => ({
                          ...current,
                          drawEffects: current.drawEffects.filter(
                            (entry) => entry.id !== effect.id,
                          ),
                        }))
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <aside className="calc-sidebar">
          <section className="calc-panel">
            <div className="calc-section-head">
              <h2>Results</h2>
              <p>These are exact probabilities, not Monte Carlo estimates.</p>
            </div>

            {'error' in calculation ? (
              <p className="calc-error">{calculation.error}</p>
            ) : (
              <>
                <div className="calc-result-grid">
                  <div className="calc-stat">
                    <span>Playable opening hand</span>
                    <strong>{formatPercent(calculation.result.openingHandProbability)}</strong>
                  </div>
                  <div className="calc-stat">
                    <span>After draw effects</span>
                    <strong>{formatPercent(calculation.result.resolvedProbability)}</strong>
                  </div>
                  <div className="calc-stat">
                    <span>Gain from draw effects</span>
                    <strong>{formatSignedPercent(calculation.result.drawEffectGain)}</strong>
                  </div>
                  <div className="calc-stat">
                    <span>Unnamed filler cards</span>
                    <strong>{calculation.result.fillerCards}</strong>
                  </div>
                </div>

                <div className="calc-table-wrap">
                  <table className="calc-table">
                    <thead>
                      <tr>
                        <th>Starter line</th>
                        <th>Open 5</th>
                        <th>After draws</th>
                        <th>Gain</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calculation.result.recipeProbabilities.map((recipe) => (
                        <tr key={recipe.recipeId}>
                          <td>{recipe.label}</td>
                          <td>{formatPercent(recipe.openingHandProbability)}</td>
                          <td>{formatPercent(recipe.resolvedProbability)}</td>
                          <td>
                            {formatSignedPercent(
                              recipe.resolvedProbability - recipe.openingHandProbability,
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>

          <section className="calc-panel">
            <div className="calc-section-head">
              <h2>Model assumptions</h2>
            </div>
            <ul className="calc-notes">
              <li>Card pools are disjoint. Count each real card in exactly one pool.</li>
              <li>
                The one-card starter count is treated as a single pool that
                automatically creates its own starter line.
              </li>
              <li>
                Draw effects are resolved optimally to maximize the chance of
                reaching a starter line.
              </li>
              <li>
                Each draw effect currently assumes a simple activation cost of
                spending one copy of that card from hand.
              </li>
            </ul>
          </section>
        </aside>
      </section>
    </main>
  )
}

function buildCalculationState(formState: CalculatorFormState) {
  try {
    const input: OpeningHandCalculationInput = {
      deckSize: formState.deckSize,
      openingHandSize: formState.openingHandSize,
      pools: [
        {
          id: 'one-card-starters',
          label: 'One-card starters',
          copies: formState.oneCardStarterCopies,
        },
        ...formState.comboPools.map((pool) => ({
          id: pool.id,
          label: pool.label.trim() || 'Unnamed combo pool',
          copies: pool.copies,
        })),
        ...formState.drawEffects.map((effect) => ({
          id: effect.id,
          label: effect.label.trim() || 'Unnamed draw effect',
          copies: effect.copies,
          drawEffect: {
            drawsPerActivation: effect.drawsPerActivation,
            maxActivations: effect.maxActivations,
          },
        })),
      ],
      recipes: [
        {
          id: 'one-card-line',
          label: 'Any one-card starter',
          requirements: [{ poolId: 'one-card-starters', count: 1 }],
        },
        ...formState.comboRecipes.map((recipe) => ({
          id: recipe.id,
          label: recipe.label.trim() || 'Unnamed combo line',
          requirements: formState.comboPools.map((pool) => ({
            poolId: pool.id,
            count: recipe.requirements[pool.id] ?? 0,
          })),
        })),
      ],
    }

    return {
      result: calculateOpeningHandProbabilities(input),
    }
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : 'The calculator could not build a valid probability model.',
    }
  }
}

function readInteger(value: string) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(2)}%`
}

function formatSignedPercent(value: number) {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${(value * 100).toFixed(2)}%`
}

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}
