import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
const nm = p => fileURLToPath(new URL(`./node_modules/${p}`, import.meta.url))
export default defineConfig({ plugins: [react()], server: { fs: { strict: false } },
  resolve: { alias: { '@testing-library/react': nm('@testing-library/react'), '@xterm/xterm': nm('@xterm/xterm') } },
  test: { environment: 'jsdom', include: ['../tests/frontend/**/*.test.jsx'], testTimeout: 15000 } })
