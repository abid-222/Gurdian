// Terminal page: quick buttons, Enter, Tab completion, history and server output (xterm + WebSocket are faked).
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

const h = vi.hoisted(() => ({ term: null, ws: null }))
vi.mock('@xterm/xterm', () => ({ Terminal: class { constructor() { this.out = []; this.onDataCb = null; h.term = this } open() {} write(s) { this.out.push(s) } onData(cb) { this.onDataCb = cb } dispose() {} } }))
import Terminal from '../../frontend/src/pages/Terminal'

beforeEach(() => {
  h.ws = null
  globalThis.WebSocket = class { constructor(url) { this.url = url; this.readyState = 1; this.sent = []; h.ws = this } send(m) { this.sent.push(m) } close() {} }
})
afterEach(cleanup)
const type = s => [...s].forEach(ch => h.term.onDataCb(ch))

test('connects to /api/terminal and shows the green prompt', () => {
  render(<Terminal />); expect(h.ws.url).toMatch(/\/api\/terminal$/); h.ws.onopen(); expect(h.term.out.join('')).toContain('guardian@ubuntu:~$ ')
})
test('quick-command button sends the command', () => {
  render(<Terminal />); fireEvent.click(screen.getByText('guardian ports')); expect(h.ws.sent).toEqual(['guardian ports'])
})
test('typing + Tab completes, Enter sends, server output is printed with a new prompt', () => {
  render(<Terminal />); type('guardian st'); h.term.onDataCb('\t'); h.term.onDataCb('\r')
  expect(h.ws.sent).toEqual(['guardian status']); h.ws.onmessage({ data: 'cpu_pct: 5\nram_pct: 7' })
  const all = h.term.out.join('')
  expect(all).toContain('cpu_pct: 5\r\nram_pct: 7\r\n')
  expect(all.endsWith('guardian@ubuntu:~$ ')).toBe(true)
})
test('arrow-up recalls the last command', () => {
  render(<Terminal />); type('help'); h.term.onDataCb('\r'); h.term.onDataCb('\x1b[A'); h.term.onDataCb('\r')
  expect(h.ws.sent).toEqual(['help', 'help'])
})
test('closed socket: quick button does nothing', () => {
  render(<Terminal />); h.ws.readyState = 3; fireEvent.click(screen.getByText('help')); expect(h.ws.sent).toEqual([])
})
