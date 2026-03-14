import { defineConfig } from 'vite'
import { nitro } from 'nitro/vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import viteReact, { reactCompilerPreset } from '@vitejs/plugin-react'
import { srcAlias } from './vite.shared.js'

const config = defineConfig(async () => ({
  resolve: {
    alias: srcAlias,
    tsconfigPaths: true,
  },
  plugins: [
    devtools(),
    tailwindcss(),
    tanstackStart(),
    nitro({ preset: 'bun' }),
    viteReact(),
    await babel({ presets: [reactCompilerPreset()] }),
  ],
}))

export default config
