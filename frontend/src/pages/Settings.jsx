import { useState } from 'react'
import { api } from '../api'
import { Badge, Btn, Card, ErrorBox } from '../components/ui'

const THEMES = [
  { id: 'ubuntu', name: 'Ubuntu Aubergine', color: '#e95420' },
  { id: 'tokyo-night', name: 'Tokyo Night', color: '#7aa2f7' },
  { id: 'nord', name: 'Nord Arctic', color: '#88c0d0' },
  { id: 'dracula', name: 'Dracula Vampire', color: '#bd93f9' }
]

const DEFAULT_WATCHED = [
  '/etc/passwd',
  '/etc/shadow',
  '/etc/group',
  '/etc/sudoers',
  '/etc/hosts',
  '/etc/ssh/sshd_config',
  '/etc/crontab',
  '~/.bashrc',
  '~/.ssh/authorized_keys',
  'C:\\Windows\\System32\\drivers\\etc\\hosts'
]

export default function Settings({ theme, setTheme }) {
  const [newPath, setNewPath] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [intervalTime, setIntervalTime] = useState('3s')

  const addWatch = async (e) => {
    e.preventDefault()
    if (!newPath.trim()) return
    setLoading(true)
    setErr('')
    setMsg('')
    try {
      const res = await api('/api/watch', 'POST', { path: newPath.trim() })
      if (res.ok) {
        setMsg(`Successfully added "${newPath}" to custom Watchlist!`)
        setNewPath('')
      }
    } catch (ex) {
      setErr(ex.message || 'Failed to add file to watch')
    }
    setLoading(false)
  }

  return (
    <div>
      <ErrorBox error={err} />
      {msg && <p style={{ color: 'var(--g)', fontWeight: 600 }}>✓ {msg}</p>}

      <div className="grid">
        {/* Theme Settings */}
        <Card title="🎨 Dashboard Theme Switcher">
          <p className="dim">Select your preferred desktop cyberpunk/terminal theme:</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            {THEMES.map(t => (
              <button
                key={t.id}
                className={`btn ${theme === t.id ? 'on' : ''}`}
                style={{ borderColor: t.color }}
                onClick={() => setTheme(t.id)}
              >
                <i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: t.color, marginRight: 6 }} />
                {t.name}
              </button>
            ))}
          </div>
        </Card>

        {/* Refresh Interval Settings */}
        <Card title="⏱️ Global Telemetry & Refresh Rate">
          <p className="dim">Polling and live streaming update interval:</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            {['1s', '3s', '5s', '10s', 'manual'].map(iv => (
              <Btn key={iv} on={intervalTime === iv} onClick={() => setIntervalTime(iv)}>
                {iv}
              </Btn>
            ))}
          </div>
        </Card>
      </div>

      {/* File Vault Watchlist Management */}
      <Card title="🛡️ File Vault Watchlist Management">
        <p className="dim">
          Add an absolute critical system file path to monitor for unauthorized modifications. SHA-256 hashes are recalculated on every scan.
        </p>
        <form onSubmit={addWatch} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          <input
            className="table-search"
            style={{ flex: 1, minWidth: 280 }}
            placeholder="/etc/security/pam_env.conf or C:\path\file"
            value={newPath}
            onChange={e => setNewPath(e.target.value)}
          />
          <Btn type="submit" loading={loading} disabled={!newPath.trim()}>
            + Add to Watchlist
          </Btn>
        </form>

        <h4>Shipped Core Watchlist Rules (Sample):</h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {DEFAULT_WATCHED.map(w => (
            <Badge key={w} v={w} tone="c" />
          ))}
        </div>
      </Card>

      {/* System Security Environment */}
      <Card title="🔒 Security Architecture Policy">
        <div className="dim" style={{ lineHeight: 1.6 }}>
          <div>• <b>Zero Mock Mode</b>: Strictly real kernel metrics via /proc/stat, /proc/net/dev, and Windows PowerShell WMI.</div>
          <div>• <b>Read-Only Collectors</b>: No collectors execute destructive commands or modify host state.</div>
          <div>• <b>Token Handshake</b>: Vite proxy injects ephemeral cryptographic X-Guardian-Token on all requests.</div>
          <div>• <b>Sandboxed Database</b>: State, baseline hashes, and events reside in isolated SQLite database.</div>
        </div>
      </Card>
    </div>
  )
}
