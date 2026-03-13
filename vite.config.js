import { defineConfig } from 'vite'
import netlify from '@netlify/vite-plugin-tanstack-start'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import viteReact, { reactCompilerPreset } from '@vitejs/plugin-react'

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
    await babel({ presets: [reactCompilerPreset()] }),
  ],
}))

export default config
