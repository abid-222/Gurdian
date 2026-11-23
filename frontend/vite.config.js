import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
const headers = { 'X-Guardian-Token': process.env.GUARDIAN_TOKEN || '' }   // start.sh exports the token; the browser never sees it
export default defineConfig({ plugins: [react()], server: { port: 5173, host: 'localhost', proxy: {
  '/api': { target: 'http://127.0.0.1:8000', ws: true, headers }, '/ws': { target: 'ws://127.0.0.1:8000', ws: true, headers } } } })
