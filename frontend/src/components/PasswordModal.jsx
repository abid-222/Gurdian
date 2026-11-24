import { useState } from 'react'
import { Lock, Unlock, KeyRound, X, AlertTriangle } from 'lucide-react'
import { api, setSessionToken } from '../api'
import { Badge, Btn } from './ui'

export default function PasswordModal({ authStatus, onClose, onRefresh, onLock }) {
  const isProtected = Boolean(authStatus?.enabled)
  const [tab, setTab] = useState(isProtected ? 'change' : 'enable') // 'enable' | 'change' | 'disable'
  const [username, setUsername] = useState(authStatus?.username || '')
  const [oldPass, setOldPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const handleEnable = async e => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      const res = await api('/api/auth/setup', 'POST', { mode: 'protected', username: username.trim(), password: newPass })
      if (res.session_token) setSessionToken(res.session_token)
      onRefresh()
      onClose()
    } catch (ex) {
      setErr(ex.message || 'Failed to enable password')
    } finally {
      setBusy(false)
    }
  }

  const handleChange = async e => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      const res = await api('/api/auth/change-password', 'POST', {
        old_password: oldPass,
        new_password: newPass,
        new_username: username.trim(),
      })
      if (res.session_token) setSessionToken(res.session_token)
      onRefresh()
      onClose()
    } catch (ex) {
      setErr(ex.message || 'Failed to change password')
    } finally {
      setBusy(false)
    }
  }

  const handleDisable = async e => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      await api('/api/auth/disable', 'POST', { password: oldPass })
      setSessionToken('')
      onRefresh()
      onClose()
    } catch (ex) {
      setErr(ex.message || 'Incorrect password')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pal-overlay" onClick={onClose}>
      <div className="pal" style={{ width: 'min(440px, 94vw)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isProtected ? <Lock size={16} color="var(--g)" /> : <Unlock size={16} color="var(--c)" />}
            <span style={{ fontWeight: 600, fontSize: 14 }}>Password Protection</span>
            <Badge v={isProtected ? 'PROTECTED' : 'OPEN'} tone={isProtected ? 'g' : 'c'} />
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--dim)', cursor: 'pointer', padding: 2 }}>
            <X size={16} />
          </button>
        </div>

        {isProtected && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            <Btn on={tab === 'change'} onClick={() => { setTab('change'); setErr('') }} className="btn-sm">
              <KeyRound size={12} /> Old → New Password
            </Btn>
            <Btn on={tab === 'disable'} onClick={() => { setTab('disable'); setErr('') }} className="btn-sm">
              <Unlock size={12} /> Disable
            </Btn>
            <Btn onClick={() => { onClose(); onLock() }} className="btn-sm" style={{ marginLeft: 'auto', color: 'var(--a)' }}>
              <Lock size={12} /> Lock Now
            </Btn>
          </div>
        )}

        {err && (
          <div style={{ padding: '8px 10px', borderRadius: 6, background: 'rgba(229,72,77,0.12)', color: 'var(--r)', fontSize: 12, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={13} /> {err}
          </div>
        )}

        {!isProtected && (
          <form onSubmit={handleEnable} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="dim" style={{ fontSize: 12 }}>Add a User ID &amp; Password to lock Guardian OS:</div>
            <input className="table-search" style={{ width: '100%' }} placeholder="User ID (min 3 chars)" value={username} onChange={e => setUsername(e.target.value)} required />
            <input type="password" className="table-search" style={{ width: '100%' }} placeholder="New Password (min 6 chars)" value={newPass} onChange={e => setNewPass(e.target.value)} required />
            <Btn type="submit" variant="primary" loading={busy} style={{ justifyContent: 'center' }}>Enable Password Protection</Btn>
          </form>
        )}

        {isProtected && tab === 'change' && (
          <form onSubmit={handleChange} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input className="table-search" style={{ width: '100%' }} placeholder="User ID" value={username} onChange={e => setUsername(e.target.value)} required />
            <input type="password" className="table-search" style={{ width: '100%' }} placeholder="Current (Old) Password" value={oldPass} onChange={e => setOldPass(e.target.value)} required />
            <input type="password" className="table-search" style={{ width: '100%' }} placeholder="New Password (min 6 chars)" value={newPass} onChange={e => setNewPass(e.target.value)} required />
            <Btn type="submit" variant="primary" loading={busy} style={{ justifyContent: 'center' }}>Update Password</Btn>
          </form>
        )}

        {isProtected && tab === 'disable' && (
          <form onSubmit={handleDisable} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="dim" style={{ fontSize: 12 }}>Confirm your current password to switch back to Open Mode:</div>
            <input type="password" className="table-search" style={{ width: '100%' }} placeholder="Current Password" value={oldPass} onChange={e => setOldPass(e.target.value)} required />
            <Btn type="submit" variant="danger" loading={busy} style={{ justifyContent: 'center' }}>Confirm Open Mode</Btn>
          </form>
        )}
      </div>
    </div>
  )
}
