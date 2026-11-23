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
import Settings from './pages/Settings'
import About from './pages/About'

const VIEWS = {
  overview: Overview,
  live: Live,
  process: Process,
  network: Network,
  auth: Auth,
  integrity: FileVault,
  persistence: Persistence,
  usb: Usb,
  system: Generic,
  alerts: Alerts,
  timeline: Timeline,
  terminal: Terminal,
  settings: Settings,
  about: About,
  demo: Demo,
  reports: Reports
}

const PAGES = Object.keys(VIEWS)
const BOOT = [
  'Mounting data sources (linux /proc, windows interop)',
  'Starting guardian-api.service',
  'Loading risk engine',
  'Opening dashboard'
]

const Boot = () => (
  <div className="boot">
    {BOOT.map((l, i) => (
      <div key={i} style={{ opacity: 0, animation: `f .3s ${i * 0.35}s forwards` }}>
        <span style={{ color: 'var(--g)' }}>[  OK  ]</span> {l}
      </div>
    ))}
    <style>{'@keyframes f{to{opacity:1}}'}</style>
  </div>
)

function Pal({ go, close }) {
  const [q, setQ] = useState('')
  const m = PAGES.filter(p => p.includes(q.toLowerCase()))
  return (
    <div className="pal-overlay" onClick={close}>
      <div className="pal" onClick={e => e.stopPropagation()}>
        <input
          autoFocus
          value={q}
          placeholder="Type to search pages... (Enter / Esc)"
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && m[0]) go(m[0])
            if (e.key === 'Escape') close()
          }}
        />
        {m.map(p => (
          <div key={p} onClick={() => go(p)}>
            <span>▸ {p}</span>
            <span className="dim">Jump to #{p}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Main() {
  const getHashPage = () => {
    const h = (typeof window !== 'undefined' ? window.location.hash : '').replace(/^#\/?/, '').trim().toLowerCase()
    return VIEWS[h] ? h : 'overview'
  }

  const [page, setPage] = useState(getHashPage)
  const [src, setSrc] = useState('both')
  const [pal, setPal] = useState(false)
  const [score, setScore] = useState(0)
  const [now, setNow] = useState(new Date())
  const [theme, setTheme] = useState(() => (typeof localStorage !== 'undefined' ? localStorage.getItem('guardian_theme') || 'ubuntu' : 'ubuntu'))
  const [toasts, setToasts] = useState([])
  const [hasHighAlert, setHasHighAlert] = useState(false)

  // Sync theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem('guardian_theme', theme)
    } catch {
      // Storage unavailable in tests or sandbox
    }
  }, [theme])

  // Hash route listener (back/forward button + direct link)
  useEffect(() => {
    const onHashChange = () => setPage(getHashPage())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const navigate = useCallback((p) => {
    setPage(p)
    if (typeof window !== 'undefined') {
      window.location.hash = `#/${p}`
    }
  }, [])

  const bump = useCallback(() => {
    api('/api/score').then(d => setScore(d.score)).catch(() => {})
    api('/api/alerts?severity=HIGH').then(alerts => {
      const unack = (alerts || []).filter(a => !a.acknowledged)
      if (unack.length > 0) {
        setHasHighAlert(true)
        const latest = unack[0]
        setToasts(prev => {
          if (!prev.some(t => t.id === latest.id)) {
            return [...prev.slice(-2), latest]
          }
          return prev
        })
      } else {
        setHasHighAlert(false)
      }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    bump()
    const t = setInterval(() => {
      setNow(new Date())
      bump()
    }, 5000)

    const k = e => {
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault()
        setPal(v => !v)
      }
    }
    window.addEventListener('keydown', k)
    return () => {
      clearInterval(t)
      window.removeEventListener('keydown', k)
    }
  }, [bump])

  const V = VIEWS[page] || Overview

  return (
    <div className="app">
      {/* Toast Notification Container */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className="toast">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <b style={{ color: 'var(--r)' }}>⚠️ HIGH THREAT DETECTED</b>
              <button
                className="btn btn-sm btn-danger"
                style={{ padding: '0 4px', margin: 0 }}
                onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
              >
                ×
              </button>
            </div>
            <div style={{ marginTop: 4, fontSize: 11 }}>[{t.module}] {t.message}</div>
          </div>
        ))}
      </div>

      {pal && (
        <Pal
          go={p => { navigate(p); setPal(false) }}
          close={() => setPal(false)}
        />
      )}

      {/* Top Header Bar */}
      <header className="top">
        <span className="dots">
          <i style={{ background: '#f85149' }} />
          <i style={{ background: '#d29922' }} />
          <i style={{ background: '#3fb950' }} />
        </span>
        <div className="top-brand">
          <b style={{ color: 'var(--g)' }}>Smart OS Guardian</b>
          <span className="badge p">v6.0</span>
        </div>
        <span style={{ flex: 1 }} />

        {/* Theme quick selector */}
        <select
          value={theme}
          onChange={e => setTheme(e.target.value)}
          style={{
            background: 'var(--bg)',
            color: 'var(--fg)',
            border: '1px solid var(--line)',
            borderRadius: 4,
            padding: '3px 8px',
            font: 'inherit',
            fontSize: 11,
            marginRight: 8
          }}
        >
          <option value="ubuntu">Ubuntu</option>
          <option value="tokyo-night">Tokyo Night</option>
          <option value="nord">Nord</option>
          <option value="dracula">Dracula</option>
        </select>

        <span className="dim" style={{ marginRight: 6 }}>Source:</span>
        {['linux', 'windows', 'both'].map(s => (
          <button
            key={s}
            className={'btn' + (s === src ? ' on' : '')}
            style={{ margin: 0, padding: '3px 8px', fontSize: 11 }}
            onClick={() => setSrc(s)}
          >
            {s}
          </button>
        ))}
      </header>

      {/* Sidebar Navigation */}
      <nav className="side">
        {PAGES.map(p => (
          <button
            key={p}
            className={`side-btn ${p === page ? 'on' : ''}`}
            onClick={() => navigate(p)}
            aria-current={p === page ? 'page' : undefined}
          >
            <span style={{ color: p === page ? 'var(--g)' : 'var(--dim)', width: 14 }}>
              {p === page ? '▸' : ' '}
            </span>
            <span>{p}</span>
          </button>
        ))}
      </nav>

      {/* Main Workspace Pane */}
      <main className="main">
        <h2>
          <span>{page}</span>
          <span className="dim" style={{ fontSize: 12, fontWeight: 400 }}>
            Press <kbd style={{ background: 'var(--panel)', padding: '2px 5px', borderRadius: 3, border: '1px solid var(--line)' }}>Ctrl+K</kbd> to jump
          </span>
        </h2>
        <V key={page + src} mod={page} src={src} bump={bump} theme={theme} setTheme={setTheme} />
      </main>

      {/* tmux / i3 Style Status Bar */}
      <footer className={`bar ${hasHighAlert ? 'bar-alert-flash' : ''}`}>
        <span>[0:guardian*]</span>
        <span>pane:{page}</span>
        <span>src:{src}</span>
        <span>risk:{score} ({score < 30 ? 'SAFE' : score < 60 ? 'WARN' : 'CRIT'})</span>
        <span style={{ flex: 1 }} />
        {hasHighAlert && <span style={{ color: '#fff', fontWeight: 'bold' }}>⚡ THREAT ALERT ACTIVE</span>}
        <span>Ctrl+K</span>
        <span>{now.toLocaleTimeString()}</span>
      </footer>
    </div>
  )
}

export default function App() {
  const [b, setB] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setB(false), 1200)
    return () => clearTimeout(t)
  }, [])
  return b ? <Boot /> : <Main />
}
