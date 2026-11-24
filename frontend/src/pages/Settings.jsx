import { useState, useEffect } from 'react'
import { Palette, Clock, ShieldCheck, Lock, Check, Plus, Server, Settings as SettingsIcon } from 'lucide-react'
import { api } from '../api'
import { Badge, Btn, Card, ErrorBox } from '../components/ui'

const THEMES = [
  { id: 'ubuntu', name: 'Ubuntu Aubergine', desc: 'Graphite & emerald default', color: '#e95420' },
  { id: 'light', name: 'Ubuntu Clean Light', desc: 'High-contrast paper light', color: '#0284c7' },
  { id: 'tokyo-night', name: 'Tokyo Night', desc: 'Deep indigo slate', color: '#7aa2f7' },
  { id: 'nord', name: 'Nord Arctic', desc: 'Cool polar blue-gray', color: '#88c0d0' },
  { id: 'dracula', name: 'Dracula Vampire', desc: 'Muted violet dark', color: '#bd93f9' },
]

const DEFAULT_WATCHED = [
  { path: '/etc/passwd', scope: 'Linux Users' },
  { path: '/etc/shadow', scope: 'Linux Auth' },
  { path: '/etc/group', scope: 'Linux Groups' },
  { path: '/etc/sudoers', scope: 'Privilege Policy' },
  { path: '/etc/hosts', scope: 'DNS Mapping' },
  { path: '/etc/ssh/sshd_config', scope: 'SSH Daemon' },
  { path: '/etc/crontab', scope: 'Scheduled Tasks' },
  { path: '~/.bashrc', scope: 'Shell Profile' },
  { path: '~/.ssh/authorized_keys', scope: 'SSH Keys' },
  { path: 'C:\\Windows\\System32\\drivers\\etc\\hosts', scope: 'Windows DNS' },
]

const POLICIES = [
  { title: 'Zero Mock Data Policy', status: 'ENFORCED', desc: 'All metrics, sockets, and alerts are collected directly from host OS telemetry.' },
  { title: 'Read-Only Collectors', status: 'ENFORCED', desc: 'Monitoring collectors never execute destructive commands or alter host state.' },
  { title: 'Token Handshake', status: 'ACTIVE', desc: 'Ephemeral X-Guardian-Token header authenticates all API and WebSocket traffic.' },
  { title: 'Sandboxed SQLite WAL', status: 'ACTIVE', desc: 'Baselines, alerts, and audit logs persist in an isolated WAL-mode database.' },
]

export default function Settings({ theme, setTheme }) {
  const [newPath, setNewPath] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [intervalTime, setIntervalTime] = useState(() => {
    try {
      return localStorage.getItem('guardian_refresh_interval') || '3s'
    } catch {
      return '3s'
    }
  })
  const [customPaths, setCustomPaths] = useState([])
  const [sysInfo, setSysInfo] = useState(null)

  useEffect(() => {
    api('/api/info')
      .then(d => d && setSysInfo(d))
      .catch(() => {})
  }, [])

  const updateInterval = iv => {
    setIntervalTime(iv)
    try {
      localStorage.setItem('guardian_refresh_interval', iv)
    } catch {
      // Ignore storage error
    }
    setMsg(`Telemetry refresh interval updated to ${iv}.`)
  }

  const addWatch = async e => {
    e.preventDefault()
    const clean = newPath.trim()
    if (!clean) return
    setLoading(true)
    setErr('')
    setMsg('')
    try {
      const res = await api('/api/watch', 'POST', { path: clean })
      if (res.ok) {
        setCustomPaths(prev => (prev.includes(clean) ? prev : [clean, ...prev]))
        setMsg(`Added "${clean}" to the File Integrity Watchlist.`)
        setNewPath('')
      }
    } catch (ex) {
      setErr(ex.message || 'Failed to add file to watchlist')
    }
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Formal Page Header */}
      <div
        className="card"
        style={{
          marginBottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: 'var(--panel-hover)',
              border: '1px solid var(--line)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent)',
            }}
          >
            <SettingsIcon size={18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--fg)' }}>
                System Settings &amp; Configuration
              </h1>
              <Badge v="ACTIVE" tone="g" />
            </div>
            <div className="dim" style={{ fontSize: 12, marginTop: 2 }}>
              Configure interface theme, telemetry polling intervals, file integrity watchlists, and security policies.
            </div>
          </div>
        </div>

        {sysInfo && (
          <div className="mono dim" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Server size={13} color="var(--c)" />
            <span>{sysInfo.host || 'localhost'} · {sysInfo.os || 'Host OS'}</span>
          </div>
        )}
      </div>

      <ErrorBox error={err} />
      {msg && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            background: 'rgba(76, 195, 138, 0.1)',
            border: '1px solid rgba(76, 195, 138, 0.3)',
            color: 'var(--g)',
            fontSize: 12,
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Check size={15} /> {msg}
        </div>
      )}

      {/* Appearance & Telemetry Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <Card
          title={
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Palette size={15} color="var(--c)" /> Dashboard Theme Switcher
            </span>
          }
          style={{ marginBottom: 0 }}
        >
          <p className="dim" style={{ margin: '0 0 12px', fontSize: 12 }}>
            Select a calibrated color profile for the security console:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: 8 }}>
            {THEMES.map(t => {
              const active = theme === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  style={{
                    textAlign: 'left',
                    padding: '10px 12px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    background: active ? 'var(--panel-hover)' : 'var(--bg)',
                    border: `1px solid ${active ? t.color : 'var(--line)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg)' }}>{t.name}</div>
                      <div className="dim" style={{ fontSize: 10 }}>{t.desc}</div>
                    </div>
                  </div>
                  {active && <Check size={13} color={t.color} />}
                </button>
              )
            })}
          </div>
        </Card>

        <Card
          title={
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={15} color="var(--c)" /> Global Telemetry &amp; Refresh Rate
            </span>
          }
          style={{ marginBottom: 0 }}
        >
          <p className="dim" style={{ margin: '0 0 12px', fontSize: 12 }}>
            Configure live streaming and background polling frequency:
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {['1s', '3s', '5s', '10s', 'manual'].map(iv => (
              <Btn key={iv} on={intervalTime === iv} onClick={() => updateInterval(iv)}>
                {iv === 'manual' ? 'Manual Only' : `Every ${iv}`}
              </Btn>
            ))}
          </div>
          <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--line)', fontSize: 11, color: 'var(--text-secondary)' }}>
            Active interval: <b className="mono" style={{ color: 'var(--fg)' }}>{intervalTime}</b> · Saved automatically to browser profile.
          </div>
        </Card>
      </div>

      {/* File Vault Watchlist Management */}
      <Card
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={15} color="var(--c)" /> File Vault Watchlist Management
          </span>
        }
        style={{ marginBottom: 0 }}
      >
        <p className="dim" style={{ margin: '0 0 12px', fontSize: 12 }}>
          Register an absolute critical system file path to monitor for unauthorized modifications. SHA-256 digests are verified on every integrity scan.
        </p>

        <form onSubmit={addWatch} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <input
            className="table-search"
            style={{ flex: 1, minWidth: 280 }}
            placeholder="/etc/security/pam_env.conf or C:\path\to\file"
            value={newPath}
            onChange={e => setNewPath(e.target.value)}
          />
          <Btn type="submit" variant="primary" loading={loading} disabled={!newPath.trim()}>
            <Plus size={14} /> Add to Watchlist
          </Btn>
        </form>

        {customPaths.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--g)', marginBottom: 6 }}>
              Custom Watchlist Entries ({customPaths.length})
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {customPaths.map(p => (
                <Badge key={p} v={p} tone="g" />
              ))}
            </div>
          </div>
        )}

        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg)', marginBottom: 8 }}>
          Shipped Core Watchlist Rules
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 8 }}>
          {DEFAULT_WATCHED.map(w => (
            <div
              key={w.path}
              style={{
                padding: '7px 10px',
                borderRadius: 6,
                background: 'var(--bg)',
                border: '1px solid var(--line)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <span className="mono" style={{ fontSize: 11, color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {w.path}
              </span>
              <Badge v={w.scope} tone="c" />
            </div>
          ))}
        </div>
      </Card>

      {/* Security Architecture Policy */}
      <Card
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Lock size={15} color="var(--c)" /> Security Architecture &amp; Compliance Policy
          </span>
        }
        style={{ marginBottom: 0 }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
          {POLICIES.map(pol => (
            <div
              key={pol.title}
              style={{
                padding: 12,
                borderRadius: 8,
                background: 'var(--bg)',
                border: '1px solid var(--line)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg)' }}>{pol.title}</span>
                <Badge v={pol.status} tone="g" />
              </div>
              <div className="dim" style={{ fontSize: 11, lineHeight: 1.45 }}>{pol.desc}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
