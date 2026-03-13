import { defineConfig } from 'vite'
import netlify from '@netlify/vite-plugin-tanstack-start'
import { devtools } from '@tanstack/devtools-vite'
import babel from '@rolldown/plugin-babel'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact, { reactCompilerPreset } from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const reactCompilerOptions = {
  presets: [reactCompilerPreset()],
} as Parameters<typeof babel>[0]

const config = defineConfig(async () => ({
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    devtools(),
    tailwindcss(),
    tanstackStart(),
    netlify(),
    viteReact(),
    await babel(reactCompilerOptions),
  ],
}))

export default config
