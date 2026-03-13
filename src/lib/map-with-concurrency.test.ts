import { describe, expect, it } from 'vitest'
import { mapWithConcurrencyLimit } from './map-with-concurrency'

describe('mapWithConcurrencyLimit', () => {
  it('preserves input order while respecting the concurrency cap', async () => {
    let activeWorkers = 0
    let maxActiveWorkers = 0

    const results = await mapWithConcurrencyLimit(
      [40, 10, 30, 20],
      2,
      async (delay, index) => {
        activeWorkers += 1
        maxActiveWorkers = Math.max(maxActiveWorkers, activeWorkers)

        await wait(delay)

        activeWorkers -= 1
        return `task-${index}`
      },
    )

    expect(results).toEqual(['task-0', 'task-1', 'task-2', 'task-3'])
    expect(maxActiveWorkers).toBe(2)
  })

  it('treats invalid concurrency values as a single worker', async () => {
    let activeWorkers = 0
    let maxActiveWorkers = 0

    const results = await mapWithConcurrencyLimit([1, 2, 3], 0, async (value) => {
      activeWorkers += 1
      maxActiveWorkers = Math.max(maxActiveWorkers, activeWorkers)

      await wait(5)

      activeWorkers -= 1
      return value * 2
    })

    expect(results).toEqual([2, 4, 6])
    expect(maxActiveWorkers).toBe(1)
  })
})

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
