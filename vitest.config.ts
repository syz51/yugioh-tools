import { defineConfig } from 'vitest/config'
import { srcAlias, testInclude } from './vite.shared.js'

export default defineConfig({
  resolve: {
    alias: srcAlias,
  },
  test: {
    include: testInclude,
  },
})
