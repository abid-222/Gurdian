import { useState } from 'react'
import { Shield, Lock, Unlock, KeyRound, CheckCircle2, AlertTriangle } from 'lucide-react'
import { api, setSessionToken } from '../api'
import { Btn } from './ui'

export default function AuthGate({ authStatus, onSuccess }) {
  const isFirstRun = !authStatus.initialized
  const [setupChoice, setSetupChoice] = useState('choose') // 'choose' | 'protected'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const chooseOpenMode = async () => {
    setLoading(true)
    setErr('')
    try {
      const res = await api('/api/auth/setup', 'POST', { mode: 'open' })
      setSessionToken('')
      onSuccess(res)
    } catch (e) {
      setErr(e.message || 'Setup failed')
    } finally {
      setLoading(false)
    }
  }

  const handleProtectedSetup = async e => {
    e.preventDefault()
    if (password !== confirmPass) {
      setErr('Passwords do not match')
      return
    }
    setLoading(true)
    setErr('')
    try {
      const res = await api('/api/auth/setup', 'POST', {
        mode: 'protected',
        username: username.trim(),
        password,
      })
      if (res.session_token) setSessionToken(res.session_token)
      onSuccess(res)
    } catch (e2) {
      setErr(e2.message || 'Failed to enable protection')
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async e => {
    e.preventDefault()
    setLoading(true)
    setErr('')
    try {
      const res = await api('/api/auth/login', 'POST', {
        username: username.trim(),
        password,
      })
      if (res.session_token) setSessionToken(res.session_token)
      onSuccess(res)
    } catch (e2) {
      setErr(e2.message || 'Invalid User ID or Password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        color: 'var(--fg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        className="card"
        style={{
          width: 'min(460px, 95vw)',
          marginBottom: 0,
          padding: 28,
          borderTop: '3px solid var(--accent)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: 'var(--panel-hover)',
              border: '1px solid var(--line)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent)',
            }}
          >
            {isFirstRun ? <Shield size={20} /> : <Lock size={20} />}
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
              {isFirstRun ? 'Smart OS Guardian — First-Time Setup' : 'Console Locked'}
            </h2>
            <div className="dim" style={{ fontSize: 12 }}>
              {isFirstRun
                ? 'Choose whether to protect this console with a User ID & Password.'
                : `Sign in with User ID "${authStatus.username || 'admin'}" to unlock.`}
            </div>
          </div>
        </div>

        {err && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              background: 'rgba(229, 72, 77, 0.12)',
              border: '1px solid rgba(229, 72, 77, 0.35)',
              color: 'var(--r)',
              fontSize: 12,
              marginBottom: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <AlertTriangle size={14} /> {err}
          </div>
        )}

        {isFirstRun && setupChoice === 'choose' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              onClick={() => setSetupChoice('protected')}
              style={{
                textAlign: 'left',
                padding: 14,
                borderRadius: 10,
                background: 'var(--bg)',
                border: '1px solid var(--accent)',
                color: 'var(--fg)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <Lock size={18} color="var(--accent)" />
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Protect with User ID &amp; Password (Recommended)</div>
                <div className="dim" style={{ fontSize: 11, marginTop: 2 }}>
                  Create a local User ID and Password to secure terminal, simulation, and host controls.
                </div>
              </div>
            </button>

            <button
              onClick={chooseOpenMode}
              disabled={loading}
              style={{
                textAlign: 'left',
                padding: 14,
                borderRadius: 10,
                background: 'var(--bg)',
                border: '1px solid var(--line)',
                color: 'var(--fg)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <Unlock size={18} color="var(--c)" />
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Keep Open (No Password)</div>
                <div className="dim" style={{ fontSize: 11, marginTop: 2 }}>
                  Open dashboard immediately. You can add password protection later in Settings anytime.
                </div>
              </div>
            </button>
          </div>
        )}

        {isFirstRun && setupChoice === 'protected' && (
          <form onSubmit={handleProtectedSetup} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label className="dim" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>User ID (min 3 chars)</label>
              <input
                className="table-search"
                style={{ width: '100%' }}
                placeholder="e.g. admin"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="dim" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Password (min 6 chars)</label>
              <input
                type="password"
                className="table-search"
                style={{ width: '100%' }}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="dim" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Confirm Password</label>
              <input
                type="password"
                className="table-search"
                style={{ width: '100%' }}
                placeholder="••••••••"
                value={confirmPass}
                onChange={e => setConfirmPass(e.target.value)}
                required
              />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <Btn type="button" variant="secondary" onClick={() => setSetupChoice('choose')}>Back</Btn>
              <Btn type="submit" variant="primary" loading={loading} style={{ flex: 1, justifyContent: 'center' }}>
                <CheckCircle2 size={14} /> Create Account &amp; Protect
              </Btn>
            </div>
          </form>
        )}

        {!isFirstRun && (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label className="dim" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>User ID</label>
              <input
                className="table-search"
                style={{ width: '100%' }}
                placeholder={authStatus.username || 'admin'}
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="dim" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Password</label>
              <input
                type="password"
                className="table-search"
                style={{ width: '100%' }}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            <Btn type="submit" variant="primary" loading={loading} style={{ justifyContent: 'center', marginTop: 4 }}>
              <KeyRound size={14} /> Unlock Console
            </Btn>
          </form>
        )}
      </div>
    </div>
  )
}
