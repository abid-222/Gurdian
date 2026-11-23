import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import Alerts from './pages/Alerts'
import Auth from './pages/Auth'
import Demo from './pages/Demo'
import FileVault from './pages/FileVault'
import Generic from './pages/Generic'
import Live from './pages/Live'
import Network from './pages/Network'
import Overview from './pages/Overview'
import Persistence from './pages/Persistence'
import Process from './pages/Process'
import Reports from './pages/Reports'
import Terminal from './pages/Terminal'
import Timeline from './pages/Timeline'
import Usb from './pages/Usb'
const VIEWS = { overview: Overview, live: Live, process: Process, network: Network, auth: Auth, integrity: FileVault, persistence: Persistence, usb: Usb, system: Generic, alerts: Alerts, timeline: Timeline, terminal: Terminal, demo: Demo, reports: Reports }
const PAGES = Object.keys(VIEWS)
const BOOT = ['Mounting data sources (linux /proc, windows interop)', 'Starting guardian-api.service', 'Loading risk engine', 'Opening dashboard']
const Boot = () => <div className="boot">{BOOT.map((l, i) => <div key={i} style={{ opacity: 0, animation: `f .3s ${i * .35}s forwards` }}><span style={{ color: 'var(--g)' }}>[  OK  ]</span> {l}</div>)}<style>{'@keyframes f{to{opacity:1}}'}</style></div>
function Pal({ go, close }) {
  const [q, setQ] = useState(''), m = PAGES.filter(p => p.includes(q))
  return <div className="pal"><input autoFocus value={q} placeholder="Go to page... (Enter / Esc)" onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && m[0]) go(m[0]); if (e.key === 'Escape') close() }} />{m.map(p => <div key={p} onClick={() => go(p)}>{p}</div>)}</div>
}
function Main() {
  const [page, setPage] = useState('overview'), [src, setSrc] = useState('both'), [pal, setPal] = useState(false), [score, setScore] = useState(0), [now, setNow] = useState(new Date())
  const bump = useCallback(() => api('/api/score').then(d => setScore(d.score)).catch(() => {}), [])
  useEffect(() => {
    bump(); const t = setInterval(() => setNow(new Date()), 1000), k = e => { if (e.ctrlKey && e.key === 'k') { e.preventDefault(); setPal(v => !v) } }
    addEventListener('keydown', k); return () => { clearInterval(t); removeEventListener('keydown', k) }
  }, [bump])
  const V = VIEWS[page]
  return <div className="app">{pal && <Pal go={p => { setPage(p); setPal(false) }} close={() => setPal(false)} />}
    <div className="top"><span className="dots"><i style={{ background: '#f85149' }} /><i style={{ background: '#d29922' }} /><i style={{ background: '#3fb950' }} /></span><b style={{ color: 'var(--g)' }}>Smart OS Guardian</b><span style={{ flex: 1 }} />
      Source: {['linux', 'windows', 'both'].map(s => <button key={s} className={'btn' + (s === src ? ' on' : '')} style={{ margin: 0 }} onClick={() => setSrc(s)}>{s}</button>)}</div>
    <nav className="side">{PAGES.map(p => <div key={p} className={p === page ? 'on' : ''} onClick={() => setPage(p)}>{p === page ? '▸ ' : '  '}{p}</div>)}</nav>
    <main className="main"><h2>{page}</h2><V key={page + src} mod={page} src={src} bump={bump} /></main>
    <div className="bar"><span>[0] guardian</span><span>src:{src}</span><span>risk:{score}</span><span style={{ flex: 1 }} /><span>Ctrl+K</span><span>{now.toLocaleTimeString()}</span></div></div>
}
export default function App() {
  const [b, setB] = useState(true)
  useEffect(() => { const t = setTimeout(() => setB(false), 1700); return () => clearTimeout(t) }, [])
  return b ? <Boot /> : <Main />
}
