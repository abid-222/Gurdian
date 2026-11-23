// Mock-mode smoke tests: every page renders against mock data, shows the key rows, and the error/limited states.
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { calls, installFakes } from './fakeApi'
import Alerts from '../../frontend/src/pages/Alerts'
import Auth from '../../frontend/src/pages/Auth'
import Demo from '../../frontend/src/pages/Demo'
import FileVault from '../../frontend/src/pages/FileVault'
import Generic from '../../frontend/src/pages/Generic'
import Live from '../../frontend/src/pages/Live'
import Network from '../../frontend/src/pages/Network'
import Overview from '../../frontend/src/pages/Overview'
import Persistence from '../../frontend/src/pages/Persistence'
import Process from '../../frontend/src/pages/Process'
import Reports from '../../frontend/src/pages/Reports'
import Timeline from '../../frontend/src/pages/Timeline'
import Usb from '../../frontend/src/pages/Usb'
globalThis.ResizeObserver ||= class { observe() {} unobserve() {} disconnect() {} }   // jsdom has none (Recharts needs it)
beforeEach(() => installFakes())
afterEach(cleanup)
const seen = async t => expect(await screen.findAllByText(t, { exact: false })).not.toHaveLength(0)

test('overview: buttons + last alerts', async () => { render(<Overview src="linux" bump={() => {}} />); await seen('Run Full Scan'); await seen('Export Report'); await seen('runs from a deleted binary') })
test('process: rows, flags, details panel, tree view', async () => {
  render(<Process src="linux" />); await seen('miner'); await seen('tmp_exec'); await seen('Show Suspicious Only')
  fireEvent.click(screen.getAllByText('miner').at(-1)); await seen('parent chain'); fireEvent.click(screen.getByText('Tree View')); await seen('▾')
})
test('network: NEW port + show connections', async () => { render(<Network src="linux" />); await seen('9999'); fireEvent.click(screen.getByText('Show Connections')); await seen('ESTABLISHED') })
test('auth: limited mode badge', async () => { render(<Auth src="linux" />); await seen('LIMITED MODE'); await seen('Failed Logins by IP') })
test('file vault: old/new hash view', async () => { render(<FileVault src="linux" />); await seen('CHANGED: /etc/passwd'); await seen('Add File to Watch') })
test('persistence: NEW badge + groups', async () => { render(<Persistence src="linux" />); await seen('/etc/cron.d/evil'); await seen('cron (1)') })
test('usb: windows device row', async () => { render(<Usb src="windows" />); await seen('USB Mouse') })
test('alerts: evidence drawer', async () => { render(<Alerts bump={() => {}} />); await seen('Acknowledge'); fireEvent.click(await screen.findByText('Process ghost (pid 505) runs from a deleted binary', { exact: false })); await seen('Suspicious execution') })
test('generic + demo render', async () => { render(<Generic mod="system" src="linux" />); await seen('cpu_pct'); cleanup(); render(<Demo src="windows" />); await seen('startup') })

test('process: real cpu column, top CPU / RAM cards, baseline button', async () => {
  render(<Process src="linux" />); expect(await screen.findByRole('columnheader', { name: /^cpu/ })).toBeTruthy(); await seen('Top 5 CPU'); await seen('87.5'); await seen('Top 5 RAM'); await seen('121 MB'); await seen('Save Baseline')
  fireEvent.click(screen.getByText('Save Baseline')); await seen('Baseline saved'); expect(calls.some(c => c.includes('/api/baseline/process?source=linux'))).toBe(true)
})
test('network: remote address column + connections per process', async () => {
  render(<Network src="linux" />); await seen('Connections per process'); await seen('curl'); fireEvent.click(screen.getByText('Show Connections')); await seen('8.8.8.8')
})
test('usb: honest note when WSL2 has no USB', async () => { render(<Usb src="linux" />); await seen('usbipd') })
test('timeline: events with kinds, filter by module calls the API', async () => {
  render(<Timeline />); await seen('root from 10.0.0.9'); await seen('login_failed'); fireEvent.click(screen.getAllByText('auth')[0])
  await seen('Refresh'); expect(calls.some(c => c.includes('module=auth'))).toBe(true)
})
test('reports: html, txt and json downloads', async () => { render(<Reports />); await seen('Download JSON'); expect(screen.getByText('Download JSON').closest('a').getAttribute('href')).toBe('/api/report?fmt=json') })
test('overview: score history chart title + live cards', async () => { render(<Overview src="linux" bump={() => {}} />); await seen('Risk score history'); await seen('Export Report') })
test('live: top processes card and the server error message', async () => {
  render(<Live src="linux" />); await seen('Top 5 CPU'); await seen('miner'); cleanup()
  installFakes({ wsMessage: { error: 'OSError: boom' } }); render(<Live src="linux" />); await seen('OSError: boom')
})
test('app code ships no fake data: no mock mode left', async () => {
  const fs = await import('node:fs'), path = await import('node:path'), at = f => path.resolve(process.cwd(), f)   // vitest runs inside frontend/
  expect(fs.readFileSync(at('src/api.js'), 'utf8')).not.toMatch(/mock/i); expect(fs.existsSync(at('src/mock.js'))).toBe(false)
})
