import { useCallback, useEffect, useRef, useState } from 'react'
import {
  LayoutDashboard,
  Activity,
  Server,
  Cpu,
  Network,
  FolderLock,
  KeyRound,
  Database,
  Usb,
  Bell,
  Clock,
  FileBarChart,
  Terminal as TerminalIcon,
  Crosshair,
  Settings as SettingsIcon,
  Info,
  Shield,
  Search,
  AlertTriangle,
  X
} from 'lucide-react'
import { api } from './api'
import Alerts from './pages/Alerts'
import Auth from './pages/Auth'
import Demo from './pages/Demo'
import FileVault from './pages/FileVault'
import Generic from './pages/Generic'
import Live from './pages/Live'
import NetworkPage from './pages/Network'
import Overview from './pages/Overview'
import Persistence from './pages/Persistence'
import Process from './pages/Process'
import Reports from './pages/Reports'
import Terminal from './pages/Terminal'
import Timeline from './pages/Timeline'
import UsbPage from './pages/Usb'
import Settings from './pages/Settings'
import About from './pages/About'

// ─── View registry ──────────────────────────────────────────────────────────
const VIEWS = {
  overview: Overview,
  live: Live,
  process: Process,
  network: NetworkPage,
  auth: Auth,
  integrity: FileVault,
  persistence: Persistence,
  usb: UsbPage,
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
      { key: 'overview',  icon: LayoutDashboard, label: 'Overview'       },
      { key: 'live',      icon: Activity,        label: 'Live Stream'    },
      { key: 'system',    icon: Server,          label: 'System'         },
    ],
  },
  {
    label: 'SECURITY',
    items: [
      { key: 'process',     icon: Cpu,        label: 'Processes'      },
      { key: 'network',     icon: Network,    label: 'Network'         },
      { key: 'integrity',   icon: FolderLock, label: 'File Integrity' },
      { key: 'auth',        icon: KeyRound,   label: 'Login Activity' },
      { key: 'persistence', icon: Database,   label: 'Persistence'    },
      { key: 'usb',         icon: Usb,        label: 'USB Devices'    },
    ],
  },
  {
    label: 'EVENTS',
    items: [
      { key: 'alerts',   icon: Bell,         label: 'Alerts'    },
      { key: 'timeline', icon: Clock,        label: 'Timeline'  },
      { key: 'reports',  icon: FileBarChart, label: 'Reports'   },
    ],
  },
  {
    label: 'TOOLS',
    items: [
      { key: 'terminal', icon: TerminalIcon, label: 'Terminal' },
      { key: 'demo',     icon: Crosshair,    label: 'Demo Lab' },
      { key: 'settings', icon: SettingsIcon, label: 'Settings' },
      { key: 'about',    icon: Info,         label: 'About'    },
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--line)' }}>
          <Search size={16} color="var(--dim)" />
          <input
            ref={inputRef}
            value={q}
            placeholder="Type to jump to any page... (Esc to close)"
            style={{ margin: 0, padding: '4px 0', border: 'none', background: 'transparent' }}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && matches[0]) go(matches[0].key)
              if (e.key === 'Escape') close()
            }}
          />
        </div>
        <div>
          {matches.map(item => {
            const Icon = item.icon
            return (
              <div key={item.key} onClick={() => go(item.key)} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ color: 'var(--c)', display: 'flex' }}><Icon size={16} /></span>
                <span style={{ fontWeight: 500 }}>{item.label}</span>
                <span className="dim" style={{ marginLeft: 'auto', fontSize: 11 }}>#{item.key}</span>
              </div>
            )
          })}
          {matches.length === 0 && (
            <div className="dim" style={{ padding: '12px', textAlign: 'center' }}>No pages match "{q}"</div>
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
  const [src, setSrc]         = useState('linux')
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
  const currentItem = ALL_ITEMS.find(i => i.key === page) || { icon: LayoutDashboard, label: 'Overview' }
  const CurrentIcon = currentItem.icon
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
            <div key={t.id} className="toast" style={{ borderLeftColor: tr.color }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: tr.color, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {isSerious ? <AlertTriangle size={15} /> : <Bell size={15} />}
                  <span>{tr.label} THREAT DETECTED</span>
                </span>
                <button
                  className="btn btn-sm btn-danger"
                  style={{ padding: '0 4px', margin: 0, border: 'none', background: 'transparent' }}
                  onClick={() => dismissToast(t.id)}
                  aria-label="Dismiss"
                >
                  <X size={14} />
                </button>
              </div>
              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--dim)' }}>
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

      {/* ── Top Header Bar ── */}
      <header className="top">
        <div className="top-brand">
          <div className="brand-icon-box">
            <Shield size={18} strokeWidth={2.2} />
          </div>
          <span className="brand-title">Smart OS Guardian</span>
          <span className="badge p">PRO v6.0</span>
        </div>

        <span style={{ flex: 1 }} />

        {/* Status dot + risk chip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 10 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--line)',
              padding: '3px 10px',
              borderRadius: 20
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: hasHighAlert ? 'var(--r)' : 'var(--g)',
                boxShadow: hasHighAlert ? '0 0 8px var(--r)' : '0 0 8px var(--g)'
              }}
            />
            <span style={{ fontSize: 11, fontWeight: 600, color: hasHighAlert ? 'var(--r)' : 'var(--g)' }}>
              {hasHighAlert ? 'ALERT ACTIVE' : 'HOST SECURED'}
            </span>
          </div>

          <span
            className="badge"
            style={{
              background: risk.color + '18',
              color: risk.color,
              borderColor: risk.color,
              padding: '3px 10px',
              fontSize: 11,
              fontWeight: 700,
              borderRadius: 14
            }}
          >
            Risk: {score} · {risk.label}
          </span>
        </div>

        {/* Theme select */}
        <select
          value={theme}
          onChange={e => setTheme(e.target.value)}
          aria-label="Theme selector"
          style={{
            background: 'var(--panel)',
            color: 'var(--fg)',
            border: '1px solid var(--line)',
            borderRadius: 8,
            padding: '5px 10px',
            fontSize: 11,
            marginRight: 8,
            cursor: 'pointer'
          }}
        >
          <option value="ubuntu">Dark Horizon</option>
          <option value="tokyo-night">Tokyo Night</option>
          <option value="nord">Nord Arctic</option>
          <option value="dracula">Dracula Core</option>
        </select>

        {/* Source selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(0,0,0,0.25)', padding: '2px 4px', borderRadius: 8, border: '1px solid var(--line)' }}>
          <span className="dim" style={{ fontSize: 10, textTransform: 'uppercase', padding: '0 4px', fontWeight: 600 }}>Source:</span>
          {['linux', 'windows', 'both'].map(s => (
            <button
              key={s}
              className={`btn btn-sm ${s === src ? 'on' : ''}`}
              style={{ margin: 0, padding: '3px 8px', fontSize: 11, textTransform: 'uppercase' }}
              onClick={() => setSrc(s)}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Ctrl+K hint button */}
        <button
          className="btn btn-sm"
          style={{ marginLeft: 6, padding: '4px 10px', fontSize: 11 }}
          onClick={() => setPal(true)}
          title="Command palette (Ctrl+K)"
        >
          <kbd style={{ fontSize: 10, background: 'rgba(255,255,255,0.08)', padding: '2px 4px', borderRadius: 3 }}>Ctrl+K</kbd>
        </button>
      </header>

      {/* ── Sidebar ── */}
      <nav className="side" aria-label="Main navigation">
        {NAV_GROUPS.map(group => (
          <div key={group.label} style={{ marginBottom: 6 }}>
            <div className="side-group-label">{group.label}</div>
            {group.items.map(item => {
              const Icon = item.icon
              const isActive = item.key === page
              return (
                <button
                  key={item.key}
                  className={`side-btn ${isActive ? 'on' : ''}`}
                  onClick={() => navigate(item.key)}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span className="side-btn-icon"><Icon size={16} /></span>
                  <span>{item.label}</span>
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      {/* ── Main content ── */}
      <main className="main">
        <div className="main-header">
          <h2>
            <CurrentIcon size={22} color="var(--c)" />
            <span>{currentItem.label}</span>
          </h2>
          <span className="dim" style={{ fontSize: 12 }}>
            Press <kbd style={{ background: 'var(--panel)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--line)' }}>Ctrl+K</kbd> for quick command jump
          </span>
        </div>
        <div>
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
