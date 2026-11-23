import { useCallback, useEffect, useRef, useState } from 'react'
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

// ─── View registry ──────────────────────────────────────────────────────────
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
  reports: Reports,
}

// ─── Sidebar structure ───────────────────────────────────────────────────────
const NAV_GROUPS = [
  {
    label: 'MONITOR',
    items: [
      { key: 'overview',  icon: '🏠', label: 'Overview'       },
      { key: 'live',      icon: '📊', label: 'Live Stream'    },
      { key: 'system',    icon: '⚙️', label: 'System'         },
    ],
  },
  {
    label: 'SECURITY',
    items: [
      { key: 'process',     icon: '🔍', label: 'Processes'      },
      { key: 'network',     icon: '🌐', label: 'Network'         },
      { key: 'integrity',   icon: '🗂️', label: 'File Integrity' },
      { key: 'auth',        icon: '🔒', label: 'Login Activity' },
      { key: 'persistence', icon: '💾', label: 'Persistence'    },
      { key: 'usb',         icon: '🔌', label: 'USB Devices'    },
    ],
  },
  {
    label: 'EVENTS',
    items: [
      { key: 'alerts',   icon: '🔔', label: 'Alerts'    },
      { key: 'timeline', icon: '📅', label: 'Timeline'  },
      { key: 'reports',  icon: '📈', label: 'Reports'   },
    ],
  },
  {
    label: 'TOOLS',
    items: [
      { key: 'terminal', icon: '💻', label: 'Terminal' },
      { key: 'demo',     icon: '🎯', label: 'Demo Lab' },
      { key: 'settings', icon: '⚙️', label: 'Settings' },
      { key: 'about',    icon: 'ℹ️', label: 'About'    },
    ],
  },
]

// Flat list of all nav items for command palette lookup
const ALL_ITEMS = NAV_GROUPS.flatMap(g => g.items)

// ─── Unified risk level (matches backend thresholds) ─────────────────────────
function riskLevel(score) {
  if (score < 30) return { label: 'SAFE',     color: 'var(--risk-safe)'     }
  if (score < 50) return { label: 'LOW',      color: 'var(--risk-low)'      }
  if (score < 70) return { label: 'MEDIUM',   color: 'var(--risk-medium)'   }
  if (score < 90) return { label: 'HIGH',     color: 'var(--risk-high)'     }
  return               { label: 'CRITICAL',  color: 'var(--risk-critical)'  }
}

// ─── Command Palette ─────────────────────────────────────────────────────────
function CommandPalette({ go, close }) {
  const [q, setQ] = useState('')
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const matches = ALL_ITEMS.filter(
    item =>
      item.label.toLowerCase().includes(q.toLowerCase()) ||
      item.key.toLowerCase().includes(q.toLowerCase())
  )

  return (
    <div className="pal-overlay" onClick={close}>
      <div className="pal" onClick={e => e.stopPropagation()}>
        <div className="pal-search-row">
          <span className="pal-search-icon">🔍</span>
          <input
            ref={inputRef}
            value={q}
            placeholder="Jump to page… (Enter · Esc to close)"
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && matches[0]) go(matches[0].key)
              if (e.key === 'Escape') close()
            }}
          />
          <kbd>Ctrl+K</kbd>
        </div>
        <div className="pal-results">
          {matches.map(item => (
            <div key={item.key} className="pal-item" onClick={() => go(item.key)}>
              <span className="pal-item-icon">{item.icon}</span>
              <span className="pal-item-label">{item.label}</span>
              <span className="pal-item-key dim">#{item.key}</span>
            </div>
          ))}
          {matches.length === 0 && (
            <div className="pal-empty dim">No pages match "{q}"</div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main App Shell ───────────────────────────────────────────────────────────
function Main() {
  const getHashPage = () => {
    const h = (typeof window !== 'undefined' ? window.location.hash : '')
      .replace(/^#\/?/, '')
      .trim()
      .toLowerCase()
    return VIEWS[h] ? h : 'overview'
  }

  const [page, setPage]       = useState(getHashPage)
  const [src, setSrc]         = useState('both')
  const [pal, setPal]         = useState(false)
  const [score, setScore]     = useState(0)
  const [theme, setTheme]     = useState(() =>
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('guardian_theme') || 'ubuntu'
      : 'ubuntu'
  )
  const [toasts, setToasts]   = useState([])
  const [hasHighAlert, setHasHighAlert] = useState(false)

  // Find meta for current page
  const currentItem = ALL_ITEMS.find(i => i.key === page) || { icon: '🏠', label: 'Overview' }
  const risk = riskLevel(score)

  // Sync theme to <html>
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem('guardian_theme', theme) } catch { /* sandbox */ }
  }, [theme])

  // Hash-based routing
  useEffect(() => {
    const onHashChange = () => setPage(getHashPage())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const navigate = useCallback(p => {
    setPage(p)
    if (typeof window !== 'undefined') window.location.hash = `#/${p}`
  }, [])

  // Poll score + high alerts
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
    const interval = setInterval(bump, 5000)
    const onKey = e => {
      if (e.ctrlKey && e.key === 'k') { e.preventDefault(); setPal(v => !v) }
    }
    window.addEventListener('keydown', onKey)
    return () => { clearInterval(interval); window.removeEventListener('keydown', onKey) }
  }, [bump])

  const V = VIEWS[page] || Overview

  // Toast severity is derived from the alert's own score field if available,
  // or falls back to the global score — either way, use riskLevel() consistently.
  const toastRisk = t => riskLevel(t.score ?? score)

  const dismissToast = id => setToasts(prev => prev.filter(t => t.id !== id))

  return (
    <div className="app">

      {/* ── Toast notifications ── */}
      <div className="toast-container">
        {toasts.map(t => {
          const tr = toastRisk(t)
          const isSerious = (t.score ?? score) >= 70
          return (
            <div key={t.id} className={`toast ${isSerious ? 'toast-serious' : ''}`}>
              <div className="toast-header">
                <span style={{ color: tr.color, fontWeight: 600 }}>
                  {isSerious ? '⚠️' : '🔔'} {tr.label} THREAT DETECTED
                </span>
                <button
                  className="toast-close"
                  onClick={() => dismissToast(t.id)}
                  aria-label="Dismiss"
                >
                  ✕
                </button>
              </div>
              <div className="toast-body">
                [{t.module}] {t.message}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Command palette ── */}
      {pal && (
        <CommandPalette
          go={p => { navigate(p); setPal(false) }}
          close={() => setPal(false)}
        />
      )}

      {/* ── Top header ── */}
      <header className="top-header">
        {/* Brand */}
        <div className="header-brand">
          <span className="brand-shield">🛡️</span>
          <span className="brand-name">Smart OS Guardian</span>
          <span className="badge badge-version">v6.0</span>
        </div>

        <div className="header-spacer" />

        {/* Status dot + risk chip */}
        <div className="header-status">
          <span
            className={`status-dot ${hasHighAlert ? 'status-dot-threat' : 'status-dot-safe'}`}
            title={hasHighAlert ? 'Threat active' : 'All clear'}
          />
          <span
            className="risk-chip"
            style={{ background: risk.color + '22', color: risk.color, borderColor: risk.color + '55' }}
          >
            Risk: {score} · {risk.label}
          </span>
        </div>

        {/* Theme selector */}
        <select
          className="header-select"
          value={theme}
          onChange={e => setTheme(e.target.value)}
          aria-label="Theme"
        >
          <option value="ubuntu">Ubuntu</option>
          <option value="tokyo-night">Tokyo Night</option>
          <option value="nord">Nord</option>
          <option value="dracula">Dracula</option>
        </select>

        {/* Source selector */}
        <div className="source-selector" role="group" aria-label="Data source">
          <span className="dim source-label">Source</span>
          {['linux', 'windows', 'both'].map(s => (
            <button
              key={s}
              className={`source-btn${s === src ? ' active' : ''}`}
              onClick={() => setSrc(s)}
            >
              {s === 'linux' ? '🐧' : s === 'windows' ? '🪟' : '⊕'} {s}
            </button>
          ))}
        </div>

        {/* Ctrl+K hint */}
        <button
          className="pal-trigger"
          onClick={() => setPal(true)}
          title="Command palette (Ctrl+K)"
        >
          <kbd>Ctrl+K</kbd>
        </button>
      </header>

      {/* ── Sidebar ── */}
      <nav className="sidebar" aria-label="Main navigation">
        {NAV_GROUPS.map(group => (
          <div key={group.label} className="nav-group">
            <div className="nav-group-label">{group.label}</div>
            {group.items.map(item => (
              <button
                key={item.key}
                className={`nav-item${item.key === page ? ' active' : ''}`}
                onClick={() => navigate(item.key)}
                aria-current={item.key === page ? 'page' : undefined}
              >
                <span className="nav-item-icon">{item.icon}</span>
                <span className="nav-item-label">{item.label}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>

      {/* ── Main content ── */}
      <main className="main-content">
        <div className="page-header">
          <h1 className="page-title">
            <span className="page-title-icon">{currentItem.icon}</span>
            {currentItem.label}
          </h1>
          <span className="dim page-hint">
            Press <kbd>Ctrl+K</kbd> to jump to any page
          </span>
        </div>
        <div className="page-body">
          <V key={page + src} mod={page} src={src} bump={bump} theme={theme} setTheme={setTheme} />
        </div>
      </main>

    </div>
  )
}

// ─── App entry — no boot screen ───────────────────────────────────────────────
export default function App() {
  return <Main />
}
