import { fileURLToPath } from 'node:url'

const srcDirectory = fileURLToPath(new URL('./src', import.meta.url))

export const srcAlias = {
  '#': srcDirectory,
  '@': srcDirectory,
}

export const testInclude = ['src/**/*.test.{ts,tsx}']
