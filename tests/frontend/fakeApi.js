// Test-only fake backend (the app itself ships NO fake data). Installs fetch + WebSocket stubs.
export const T = new Date().toISOString().slice(0, 19)
const P = (pid, ppid, name, exe, cpu, mem, flag = 'ok') => ({ source: 'linux', pid: '' + pid, ppid: '' + ppid, user: '0', name, exe_path: exe, cpu, mem, flag })
const net = (proto, p, process, status, state = 'LISTEN', remote_addr = '-', source = 'linux') => ({ source, proto, local_addr: '0.0.0.0', local_port: p, state, process, remote_addr, status })
export const DATA = {
  system: [{ source: 'linux', cpu_pct: '12', ram_pct: '41', disk_pct: '40', net_rx: '16711', net_tx: '13968', load1: '0.2', uptime_s: '3600' }],
  process: [P(1, 0, 'init', '/sbin/init', '0.1', 5000), P(200, 1, 'sshd', '/usr/sbin/sshd', '0.0', 9000), P(300, 200, 'bash', '/bin/bash', '1.5', 4000), P(404, 300, 'miner', '/tmp/miner', '87.5', 123456, 'tmp_exec'), P(505, 1, 'ghost', '/tmp/ghost (deleted)', '0.0', 700, 'deleted_binary')],
  network: [net('tcp', '22', 'sshd', 'KNOWN'), net('tcp', '9999', 'nc', 'NEW'), net('tcp', '8000', 'python', 'KNOWN'), net('tcp', '51000', 'curl', 'NEW', 'ESTABLISHED', '8.8.8.8'), net('tcp', '51001', 'curl', undefined, 'ESTABLISHED', '10.0.0.7', 'windows')],
  auth: [...Array(6)].map((_, i) => ({ source: 'linux', timestamp: T, ts: new Date(Date.now() - i * 240000).toISOString().slice(0, 19), username: 'root', source_ip: i % 3 ? '10.0.0.9' : '10.0.0.7', result: 'FAILED', method: 'ssh' }))
    .concat([{ source: 'linux', timestamp: T, ts: T, username: 'student', source_ip: '-', result: 'SUCCESS', method: 'session' }]),
  integrity: [{ source: 'linux', path: '/etc/passwd', sha256: 'a'.repeat(64), baseline_sha256: 'b'.repeat(64), status: 'CHANGED' }, { source: 'linux', path: '/etc/sudoers', sha256: 'c'.repeat(64), baseline_sha256: 'c'.repeat(64), status: 'KNOWN' }],
  persistence: [{ source: 'linux', type: 'cron', location: '/etc/cron.d/evil', content_hash: 'abc', status: 'NEW', first_seen: T }, { source: 'windows', type: 'run_key', location: 'HKCU\\Run\\Updater', content_hash: 'def', status: 'KNOWN', first_seen: T }],
  usb: [],
}
export const ALERTS = [{ id: 1, ts: Date.now() / 1000, module: 'process', source: 'linux', severity: 'HIGH', rule_id: 'deleted_binary', message: 'Process ghost (pid 505) runs from a deleted binary', evidence: 'linux\t505\t1\t0\tghost\t/tmp/ghost (deleted)', acknowledged: 0, points: 25, reference: 'Suspicious execution' }]
const EVENTS = [{ ts: Date.now() / 1000, module: 'auth', source: 'linux', kind: 'login_failed', summary: 'root from 10.0.0.9 (ssh)' }, { ts: Date.now() / 1000 - 60, module: 'process', source: 'linux', kind: 'alert', summary: '[HIGH] ghost deleted binary' }]
export const LIVE = { cpu: 33, ram: 44, disk: 40, rx: 12.5, tx: 3.5, cores: [10, 20, 30, 90] }
export const calls = []
export function route(path) {
  calls.push(path)
  if (path.includes('/api/scan/')) { const m = path.split('/api/scan/')[1].split('?')[0]; const win = path.includes('source=windows'); return { module: m, source: 'linux', scan_id: 1, started_at: T, rows: m === 'usb' && win ? [{ source: 'windows', name: 'USB Mouse', vendor_id: '046D', product_id: 'C077', serial: '-', status: 'NEW', first_seen: T }] : DATA[m] || [], alerts: [], risk_score: 0, errors: m === 'auth' ? ['Limited mode: cannot read /var/log/auth.log (run with sudo)'] : [] } }
  if (path.includes('/api/score/history')) return [{ ts: Date.now() / 1000 - 600, score: 0 }, { ts: Date.now() / 1000, score: 45 }]
  if (path.includes('/api/score')) return { score: 45, level: 'WARNING' }
  if (path.includes('/api/alerts')) return ALERTS
  if (path.includes('/api/info')) return { os: 'Ubuntu 22.04', kernel: '5.15', host: 'test', cpus: 4, mem_mb: 8000, uptime_s: 7200 }
  if (path.includes('/api/timeline')) return EVENTS
  if (path.includes('/api/history')) return { scans: [], items: [], snapshots: [] }
  return { ok: true, saved: 3, output: '' }
}
export function installFakes({ wsMessage = LIVE } = {}) {
  calls.length = 0
  globalThis.fetch = async url => ({ ok: true, status: 200, json: async () => route(String(url)) })
  globalThis.WebSocket = class { constructor(u) { this.url = u; setTimeout(() => { this.onopen?.(); this.onmessage?.({ data: JSON.stringify(wsMessage) }) }, 0) } send() {} close() {} }
}
