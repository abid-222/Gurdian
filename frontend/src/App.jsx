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
  X,
  Sun,
  Moon,
  BellOff,
  ShieldAlert,
  Lock,
  Unlock
} from 'lucide-react'
import { api, setSessionToken } from './api'
import AuthGate from './components/AuthGate'
import PasswordModal from './components/PasswordModal'
import Alerts from './pages/Alerts'
import Auth from './pages/Auth'
import Deadlock from './pages/Deadlock'
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
  deadlock: Deadlock,
  reports: Reports,
}

// ─── Sidebar structure ───────────────────────────────────────────────────────
const NAV_GROUPS = [
  {
    label: 'Monitor',
    items: [
      { key: 'overview',  icon: LayoutDashboard, label: 'Overview'       },
      { key: 'live',      icon: Activity,        label: 'Live Stream'    },
      { key: 'system',    icon: Server,          label: 'System'         },
    ],
  },
  {
    label: 'Security',
    items: [
      { key: 'process',     icon: Cpu,        label: 'Processes'      },
      { key: 'network',     icon: Network,    label: 'Network'        },
      { key: 'integrity',   icon: FolderLock, label: 'File Integrity' },
      { key: 'auth',        icon: KeyRound,   label: 'Login Activity' },
      { key: 'persistence', icon: Database,   label: 'Persistence'    },
      { key: 'usb',         icon: Usb,        label: 'USB Devices'    },
    ],
  },
  {
    label: 'Events',
    items: [
      { key: 'alerts',   icon: Bell,         label: 'Alerts'   },
      { key: 'timeline', icon: Clock,        label: 'Timeline' },
      { key: 'reports',  icon: FileBarChart, label: 'Reports'  },
    ],
  },
  {
    label: 'Tools',
    items: [
      { key: 'terminal', icon: TerminalIcon, label: 'Terminal' },
      { key: 'deadlock', icon: ShieldAlert,  label: 'Deadlock Lab' },
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
        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          {matches.map(item => {
            const Icon = item.icon
            return (
              <div
                key={item.key}
                onClick={() => go(item.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px',
                  borderRadius: 6,
                  cursor: 'pointer'
                }}
              >
                <Icon size={16} />
                <span style={{ fontWeight: 500 }}>{item.label}</span>
                <span className="dim" style={{ marginLeft: 'auto', fontSize: 11 }}>#{item.key}</span>
              </div>
            )
          })}
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
  const [src, setSrc]         = useState(() => {
    try {
      return localStorage.getItem('guardian_src') || 'both'
    } catch {
      return 'both'
    }
  })
  const [pal, setPal]         = useState(false)
  const [showKeys, setShowKeys] = useState(false)
  const [keySequence, setKeySequence] = useState('')
  const lastKeyRef            = useRef({ key: '', ts: 0 })
  const [score, setScore]     = useState(0)
  const [theme, setTheme]     = useState(() =>
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('guardian_theme') || 'ubuntu'
      : 'ubuntu'
  )
  const [toasts, setToasts]   = useState([])
  const [hasHighAlert, setHasHighAlert] = useState(false)
  const [notifyOn, setNotifyOn] = useState(() => {
    try {
      return localStorage.getItem('guardian_notify') !== 'false'
    } catch {
      return true
    }
  })
  const [authStatus, setAuthStatus] = useState({ initialized: true, enabled: false, username: null, authenticated: true })
  const [showPassModal, setShowPassModal] = useState(false)

  const refreshAuth = useCallback(() => {
    api('/api/auth/status')
      .then(st => {
        if (st && typeof st.enabled === 'boolean') setAuthStatus(st)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    refreshAuth()
  }, [refreshAuth])

  const handleLock = async () => {
    await api('/api/auth/logout', 'POST').catch(() => {})
    setSessionToken('')
    setAuthStatus(prev => ({ ...prev, authenticated: false }))
  }

  const toggleNotify = () => {
    setNotifyOn(prev => {
      const next = !prev
      try { localStorage.setItem('guardian_notify', String(next)) } catch { /* ignore */ }
      if (!next) setToasts([])
      return next
    })
  }

  // Persist source
  const changeSrc = s => {
    setSrc(s)
    try { localStorage.setItem('guardian_src', s) } catch { /* ignore */ }
  }

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

  // Poll score + unacknowledged alerts
  const bump = useCallback(() => {
    api('/api/score').then(d => setScore(d.score)).catch(() => {})
    api('/api/alerts').then(alerts => {
      const unack = (alerts || []).filter(a => !a.acknowledged)
      const hasHigh = unack.some(a => a.severity === 'HIGH' || a.severity === 'CRITICAL')
      setHasHighAlert(hasHigh)
      if (notifyOn && unack.length > 0) {
        setToasts(prev => {
          const newAlerts = unack.filter(a => !prev.some(t => t.id === a.id))
          if (newAlerts.length > 0) {
            return [...prev.slice(-2), ...newAlerts.slice(-2)]
          }
          return prev
        })
      }
    }).catch(() => {})
  }, [notifyOn])

  useEffect(() => {
    bump()
    const interval = setInterval(bump, 4000)
    const onKey = e => {
      // Ignore if user is currently typing in an input, textarea, or contentEditable element
      const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable || (e.target.closest && e.target.closest('.xterm'))
      if (isInput) {
        if (e.key === 'Escape') {
          if (typeof e.target.blur === 'function') e.target.blur()
          setPal(false)
          setShowKeys(false)
          setKeySequence('')
        }
        return
      }

      // Command palette: Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPal(v => !v)
        return
      }

      // Help modal: ? or / or F1
      if (e.key === '?' || e.key === 'F1' || (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey)) {
        e.preventDefault()
        setShowKeys(v => !v)
        return
      }

      // Escape closes overlays
      if (e.key === 'Escape') {
        setShowKeys(false)
        setPal(false)
        setKeySequence('')
        lastKeyRef.current = { key: '', ts: 0 }
        return
      }

      // Direct single number key navigation (1-9, 0)
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const numMap = {
          '1': 'overview',
          '2': 'live',
          '3': 'system',
          '4': 'process',
          '5': 'network',
          '6': 'integrity',
          '7': 'auth',
          '8': 'persistence',
          '9': 'alerts',
          '0': 'deadlock'
        }
        if (numMap[e.key]) {
          navigate(numMap[e.key])
          setKeySequence('')
          lastKeyRef.current = { key: '', ts: 0 }
          return
        }
      }

      // Two-key Go sequence (e.g. g o, g p, g d...) with generous 2.5s window
      const k = e.key.toLowerCase()
      const now = Date.now()

      if (lastKeyRef.current.key === 'g' && now - lastKeyRef.current.ts < 2500) {
        const routes = {
          o: 'overview',
          p: 'process',
          l: 'live',
          s: 'system',
          n: 'network',
          i: 'integrity',
          a: 'alerts',
          u: 'usb',
          t: 'terminal',
          d: 'deadlock',
          b: 'demo',
          r: 'reports',
          m: 'timeline',
          e: 'settings',
          h: 'about',
          k: 'auth'
        }
        if (routes[k]) {
          navigate(routes[k])
        }
        setKeySequence('')
        lastKeyRef.current = { key: '', ts: 0 }
      } else if (k === 'g' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        lastKeyRef.current = { key: 'g', ts: now }
        setKeySequence('g')
        setTimeout(() => {
          if (Date.now() - lastKeyRef.current.ts >= 2500) {
            setKeySequence('')
          }
        }, 2550)
      } else {
        setKeySequence('')
        lastKeyRef.current = { key: '', ts: 0 }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => { clearInterval(interval); window.removeEventListener('keydown', onKey) }
  }, [bump, navigate])

  const V = VIEWS[page] || Overview
  const toastRisk = t => riskLevel(t.score ?? score)
  const dismissToast = id => setToasts(prev => prev.filter(t => t.id !== id))
  const risk = riskLevel(score)

  if (!authStatus.initialized || (authStatus.enabled && !authStatus.authenticated)) {
    return <AuthGate authStatus={authStatus} onSuccess={st => setAuthStatus(st)} />
  }

  return (
    <>
      {/* ── Toast notifications (Outside Grid) ── */}
      {notifyOn && (
        <div className="toast-container">
          {toasts.map(t => {
            const tr = toastRisk(t)
            const isSerious = (t.score ?? score) >= 70 || t.severity === 'HIGH' || t.severity === 'CRITICAL'
            return (
              <div key={t.id} className="toast" style={{ borderLeftColor: tr.color }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ color: tr.color, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {isSerious ? <AlertTriangle size={15} /> : <Bell size={15} />}
                    <span>{t.severity || 'SECURITY'} ALERT</span>
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      className="btn btn-sm"
                      style={{ padding: '2px 8px', fontSize: 10, margin: 0 }}
                      onClick={() => {
                        api(`/api/alerts/${t.id}/ack`, 'POST').then(() => {
                          dismissToast(t.id)
                          bump()
                        })
                      }}
                    >
                      Acknowledge
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      style={{ padding: '0 4px', margin: 0, border: 'none', background: 'transparent' }}
                      onClick={() => dismissToast(t.id)}
                      aria-label="Dismiss"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--fg)', fontWeight: 500 }}>
                  {t.message}
                </div>
                <div style={{ marginTop: 4, fontSize: 10, color: 'var(--dim)' }}>
                  Module: [{t.module}] · Source: {t.source}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Key Sequence HUD (Visual feedback for g <key> navigation) ── */}
      {keySequence && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 9999,
            background: 'var(--panel)',
            border: '1px solid var(--accent)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
            borderRadius: 6,
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontFamily: 'monospace',
            fontSize: 12,
            color: 'var(--fg)',
            animation: 'fadeIn 0.15s ease'
          }}
        >
          <span style={{ background: 'var(--accent)', color: '#fff', padding: '2px 6px', borderRadius: 3, fontWeight: 700 }}>
            {keySequence}-
          </span>
          <span style={{ color: 'var(--dim)', fontSize: 11 }}>
            press: <b>o</b> (overview) · <b>p</b> (process) · <b>0/d</b> (deadlock) · <b>l</b> (live) · <b>n</b> (network) · <b>t</b> (terminal) · <b>a</b> (alerts)
          </span>
        </div>
      )}

      {/* ── Command palette (Outside Grid) ── */}
      {pal && (
        <CommandPalette
          go={p => { navigate(p); setPal(false) }}
          close={() => setPal(false)}
        />
      )}

      {/* ── Keyboard shortcuts overlay (Outside Grid) ── */}
      {showKeys && (
        <div className="pal-overlay" onClick={() => setShowKeys(false)}>
          <div className="pal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--fg)' }}>Keyboard Shortcuts</span>
              <button
                className="btn btn-sm"
                style={{ padding: '2px 6px', border: 'none', background: 'transparent' }}
                onClick={() => setShowKeys(false)}
              >
                <X size={14} />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span className="dim">Jump to page</span>
                <kbd style={{ fontFamily: 'monospace', background: 'var(--panel-hover)', padding: '2px 6px', borderRadius: 3 }}>Ctrl+K / ⌘K</kbd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span className="dim">Shortcuts guide</span>
                <kbd style={{ fontFamily: 'monospace', background: 'var(--panel-hover)', padding: '2px 6px', borderRadius: 3 }}>? / F1</kbd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span className="dim">Quick Overview</span>
                <kbd style={{ fontFamily: 'monospace', background: 'var(--panel-hover)', padding: '2px 6px', borderRadius: 3 }}>1 or g o</kbd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span className="dim">Live Stream</span>
                <kbd style={{ fontFamily: 'monospace', background: 'var(--panel-hover)', padding: '2px 6px', borderRadius: 3 }}>2 or g l</kbd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span className="dim">System Telemetry</span>
                <kbd style={{ fontFamily: 'monospace', background: 'var(--panel-hover)', padding: '2px 6px', borderRadius: 3 }}>3 or g s</kbd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span className="dim">Processes</span>
                <kbd style={{ fontFamily: 'monospace', background: 'var(--panel-hover)', padding: '2px 6px', borderRadius: 3 }}>4 or g p</kbd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span className="dim">Network</span>
                <kbd style={{ fontFamily: 'monospace', background: 'var(--panel-hover)', padding: '2px 6px', borderRadius: 3 }}>5 or g n</kbd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span className="dim">File Integrity</span>
                <kbd style={{ fontFamily: 'monospace', background: 'var(--panel-hover)', padding: '2px 6px', borderRadius: 3 }}>6 or g i</kbd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span className="dim">Login Activity</span>
                <kbd style={{ fontFamily: 'monospace', background: 'var(--panel-hover)', padding: '2px 6px', borderRadius: 3 }}>7 or g k</kbd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span className="dim">Alerts</span>
                <kbd style={{ fontFamily: 'monospace', background: 'var(--panel-hover)', padding: '2px 6px', borderRadius: 3 }}>9 or g a</kbd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span className="dim">Terminal</span>
                <kbd style={{ fontFamily: 'monospace', background: 'var(--panel-hover)', padding: '2px 6px', borderRadius: 3 }}>g t</kbd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span className="dim">Deadlock Lab</span>
                <kbd style={{ fontFamily: 'monospace', background: 'var(--panel-hover)', padding: '2px 6px', borderRadius: 3 }}>0 or g d</kbd>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Application Grid Shell ── */}
      <div className="app">
        {/* ── Top Header Bar ── */}
        <header className="top">
          <div className="top-brand">
            <div className="brand-icon-box">
              <Shield size={16} strokeWidth={2} />
            </div>
            <span className="brand-title">Smart OS Guardian</span>
          </div>

          <span style={{ flex: 1 }} />

          {/* Status dot + risk chip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 8 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'var(--panel-hover)',
                border: '1px solid var(--line)',
                padding: '3px 8px',
                borderRadius: 4
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: hasHighAlert ? 'var(--r)' : 'var(--g)',
                  display: 'inline-block'
                }}
              />
              <span style={{ fontSize: 11, fontWeight: 500, color: hasHighAlert ? 'var(--r)' : 'var(--fg)' }}>
                {hasHighAlert ? 'Alert active' : 'Host secured'}
              </span>
            </div>

            <span
              className="badge"
              style={{
                background: risk.color + '18',
                color: risk.color,
                borderColor: risk.color,
                padding: '2px 8px',
                fontSize: 11,
                fontWeight: 500,
                borderRadius: 4
              }}
            >
              Risk: {score} · {risk.label}
            </span>
          </div>

          {/* Notification ON/OFF Control Button */}
          <button
            className="btn btn-sm"
            onClick={toggleNotify}
            title={notifyOn ? 'Mute pop-up notifications' : 'Enable pop-up notifications'}
            style={{
              marginRight: 6,
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--panel-hover)',
              borderColor: 'var(--line)',
              color: notifyOn ? 'var(--fg)' : 'var(--dim)',
              padding: '3px 8px',
              borderRadius: 4,
              cursor: 'pointer'
            }}
          >
            {notifyOn ? (
              <>
                <Bell size={13} color="var(--g)" />
                <span style={{ fontSize: 11 }}>Alerts on</span>
              </>
            ) : (
              <>
                <BellOff size={13} color="var(--dim)" />
                <span style={{ fontSize: 11 }}>Alerts muted</span>
              </>
            )}
          </button>

          {/* Dark / Light Mode 1-Click Toggle */}
          <button
            className="btn btn-sm"
            onClick={() => setTheme(theme === 'light' ? 'ubuntu' : 'light')}
            title="Toggle Dark / Light Mode"
            style={{
              marginRight: 6,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--panel-hover)',
              borderColor: 'var(--line)',
              color: 'var(--fg)',
              padding: '3px 8px',
              borderRadius: 4
            }}
          >
            {theme === 'light' ? (
              <>
                <Moon size={13} /> <span>Dark</span>
              </>
            ) : (
              <>
                <Sun size={13} color="var(--a)" /> <span>Light</span>
              </>
            )}
          </button>

          {/* Theme select */}
          <select
            value={theme}
            onChange={e => setTheme(e.target.value)}
            aria-label="Theme selector"
            style={{
              background: 'var(--panel-hover)',
              color: 'var(--fg)',
              border: '1px solid var(--line)',
              borderRadius: 4,
              padding: '4px 8px',
              fontSize: 11,
              marginRight: 6,
              cursor: 'pointer'
            }}
          >
            <option value="ubuntu">Dark Horizon</option>
            <option value="light">Light Paper</option>
            <option value="tokyo-night">Tokyo Night</option>
            <option value="nord">Nord Arctic</option>
            <option value="dracula">Dracula Core</option>
          </select>

          {/* Source selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'var(--panel-hover)', padding: '2px 4px', borderRadius: 4, border: '1px solid var(--line)' }}>
            <span className="dim" style={{ fontSize: 10, padding: '0 4px', fontWeight: 500 }}>Source:</span>
            {['both', 'windows', 'linux'].map(s => (
              <button
                key={s}
                className={`btn btn-sm ${s === src ? 'on' : ''}`}
                style={{
                  margin: 0,
                  padding: '2px 6px',
                  fontSize: 11,
                  fontWeight: s === src ? 500 : 400,
                  borderRadius: 3
                }}
                onClick={() => changeSrc(s)}
                title={s === 'both' ? 'Unified Hybrid Defense (Monitors Windows and Linux simultaneously)' : `${s.toUpperCase()} single platform filter`}
              >
                {s === 'both' ? 'Unified' : s}
              </button>
            ))}
          </div>

          {/* Ctrl+K hint button */}
          <button
            className="btn btn-sm"
            style={{ marginLeft: 6, padding: '3px 8px', fontSize: 11, borderRadius: 4 }}
            onClick={() => setPal(true)}
            title="Command palette (Ctrl+K)"
          >
            <kbd style={{ fontSize: 10, color: 'var(--dim)' }}>Ctrl+K</kbd>
          </button>

          {/* Password Protection button (replaces ? button) */}
          <button
            className="btn btn-sm"
            style={{
              marginLeft: 6,
              padding: '3px 9px',
              fontSize: 11,
              borderRadius: 4,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              color: authStatus.enabled ? 'var(--g)' : 'var(--c)',
              borderColor: authStatus.enabled ? 'rgba(76, 195, 138, 0.35)' : 'rgba(56, 189, 248, 0.35)',
            }}
            onClick={() => setShowPassModal(true)}
            title={authStatus.enabled ? `Protected (${authStatus.username}) — Manage or Change Password` : 'Open Mode — Click to Add Password Protection'}
          >
            {authStatus.enabled ? <Lock size={12} /> : <Unlock size={12} />}
            <span>{authStatus.enabled ? 'Protected' : 'Add Password'}</span>
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
          <V mod={page} page={page} src={src} bump={bump} theme={theme} setTheme={setTheme} authStatus={authStatus} onAuthChange={refreshAuth} />
        </main>
      </div>

      {showPassModal && (
        <PasswordModal
          authStatus={authStatus}
          onClose={() => setShowPassModal(false)}
          onRefresh={refreshAuth}
          onLock={handleLock}
        />
      )}
    </>
  )
}

export default function App() {
  return <Main />
}
