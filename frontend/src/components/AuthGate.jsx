import { useEffect, useRef, useState } from 'react'
import { Shield, Lock, Unlock, KeyRound, CheckCircle2, AlertTriangle } from 'lucide-react'
import { api, setSessionToken } from '../api'
import { Btn } from './ui'

// 3D Holographic Guardian OS Canvas Background
function Guardian3DBackground({ mouseOffset }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId = 0
    let frame = 0

    // Golden-ratio icosahedron vertices for 3D cyber-core
    const phi = (1 + Math.sqrt(5)) / 2
    const rawVerts = [
      [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
      [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
      [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1],
    ].map(([x, y, z]) => {
      const len = Math.hypot(x, y, z)
      return [x / len, y / len, z / len]
    })

    const edges = [
      [0, 11], [0, 5], [0, 1], [0, 7], [0, 10],
      [1, 5], [5, 11], [11, 10], [10, 7], [7, 1],
      [3, 9], [3, 4], [3, 2], [3, 6], [3, 8],
      [4, 9], [9, 8], [8, 6], [6, 2], [2, 4],
      [1, 9], [5, 4], [11, 2], [10, 6], [7, 8],
      [9, 5], [4, 11], [2, 10], [6, 7], [8, 1],
    ]

    // Floating 3D starfield particles
    const stars = Array.from({ length: 70 }, (_, i) => ({
      x: ((i * 73) % 400) - 200,
      y: ((i * 137) % 300) - 150,
      z: ((i * 53) % 300) - 150,
      r: (i % 3) + 1,
    }))

    const render = () => {
      frame++
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }

      ctx.clearRect(0, 0, w, h)

      // Deep radial cyber glow
      const bg = ctx.createRadialGradient(w / 2, h / 2, 30, w / 2, h / 2, Math.max(w, h) * 0.65)
      bg.addColorStop(0, 'rgba(16, 185, 129, 0.16)')
      bg.addColorStop(0.45, 'rgba(56, 189, 248, 0.08)')
      bg.addColorStop(1, 'rgba(10, 11, 15, 0)')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, w, h)

      const t = frame * 0.008 + mouseOffset.current.x * 0.5
      const p = frame * 0.005 + mouseOffset.current.y * 0.4
      const cosT = Math.cos(t)
      const sinT = Math.sin(t)
      const cosP = Math.cos(p)
      const sinP = Math.sin(p)

      const project = (x, y, z, scaleMul = 1) => {
        const x1 = x * cosT - z * sinT
        const z1 = x * sinT + z * cosT
        const y2 = y * cosP - z1 * sinP
        const z2 = y * sinP + z1 * cosP + 4.2
        if (z2 <= 0.3) return null
        const s = (Math.min(w, h) * 0.52 * scaleMul) / z2
        return { x: w / 2 + x1 * s, y: h / 2 + y2 * s, z: z2 }
      }

      // Draw 3D drifting particles
      stars.forEach(st => {
        const pr = project(st.x / 70, st.y / 70, st.z / 70, 1.3)
        if (!pr) return
        ctx.beginPath()
        ctx.arc(pr.x, pr.y, st.r * 0.9, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(56, 189, 248, 0.28)'
        ctx.fill()
      })

      // Draw 3D orbital rings
      for (let ring = 0; ring < 2; ring++) {
        ctx.beginPath()
        const rad = ring === 0 ? 1.55 : 1.85
        for (let a = 0; a <= 64; a++) {
          const ang = (a / 64) * Math.PI * 2
          const rx = Math.cos(ang) * rad
          const ry = ring === 0 ? Math.sin(ang) * rad * 0.4 : Math.sin(ang) * rad * -0.55
          const rz = Math.sin(ang) * rad
          const pr = project(rx, ry, rz)
          if (!pr) continue
          if (a === 0) ctx.moveTo(pr.x, pr.y)
          else ctx.lineTo(pr.x, pr.y)
        }
        ctx.strokeStyle = ring === 0 ? 'rgba(16, 185, 129, 0.25)' : 'rgba(56, 189, 248, 0.20)'
        ctx.lineWidth = 1.2
        ctx.stroke()
      }

      // Draw 3D Icosahedron Wireframe
      const projVerts = rawVerts.map(v => project(v[0] * 1.18, v[1] * 1.18, v[2] * 1.18))
      edges.forEach(([a, b]) => {
        const pa = projVerts[a]
        const pb = projVerts[b]
        if (!pa || !pb) return
        ctx.beginPath()
        ctx.moveTo(pa.x, pa.y)
        ctx.lineTo(pb.x, pb.y)
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.32)'
        ctx.lineWidth = 1.4
        ctx.stroke()
      })

      projVerts.forEach(pv => {
        if (!pv) return
        ctx.beginPath()
        ctx.arc(pv.x, pv.y, 3, 0, Math.PI * 2)
        ctx.fillStyle = '#38bdf8'
        ctx.fill()
      })

      animId = requestAnimationFrame(render)
    }

    render()
    return () => {
      if (animId) cancelAnimationFrame(animId)
    }
  }, [mouseOffset])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  )
}

export default function AuthGate({ authStatus, onSuccess }) {
  const isFirstRun = !authStatus.initialized
  const [setupChoice, setSetupChoice] = useState('choose')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 })
  const mouseOffset = useRef({ x: 0, y: 0 })

  const handleMouseMove = e => {
    const nx = (e.clientX / window.innerWidth - 0.5) * 2
    const ny = (e.clientY / window.innerHeight - 0.5) * 2
    mouseOffset.current = { x: nx, y: ny }
    setTilt({ rx: -ny * 5, ry: nx * 5 })
  }

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
      onMouseMove={handleMouseMove}
      style={{
        position: 'relative',
        minHeight: '100vh',
        background: 'radial-gradient(circle at 50% 35%, #111824 0%, #090b10 100%)',
        color: 'var(--fg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        perspective: 1100,
        overflow: 'hidden',
      }}
    >
      <Guardian3DBackground mouseOffset={mouseOffset} />

      {/* 3D Hero Brand */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          textAlign: 'center',
          marginBottom: 22,
          transform: `rotateX(${tilt.rx * 0.6}deg) rotateY(${tilt.ry * 0.6}deg)`,
          transition: 'transform 0.12s ease-out',
        }}
      >
        <div
          className="mono"
          style={{
            fontSize: 30,
            fontWeight: 800,
            letterSpacing: '0.14em',
            background: 'linear-gradient(135deg, #34d399 0%, #38bdf8 55%, #a78bfa 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: '0 10px 30px rgba(16, 185, 129, 0.25)',
          }}
        >
          GUARDIAN OS
        </div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--dim)', letterSpacing: '0.18em', marginTop: 4 }}>
          HOST FORENSIC &amp; KERNEL DEFENSE CONSOLE
        </div>
      </div>

      {/* 3D Tilted Glassmorphic Card */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          width: 'min(450px, 95vw)',
          padding: 28,
          borderRadius: 16,
          background: 'rgba(18, 20, 28, 0.72)',
          backdropFilter: 'blur(22px)',
          WebkitBackdropFilter: 'blur(22px)',
          border: '1px solid rgba(255, 255, 255, 0.14)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), 0 24px 60px rgba(0, 0, 0, 0.6)',
          transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
          transition: 'transform 0.12s ease-out',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: 'rgba(16, 185, 129, 0.14)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#34d399',
            }}
          >
            {isFirstRun ? <Shield size={20} /> : <Lock size={20} />}
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>
              {isFirstRun ? 'First-Time Security Setup' : 'Authenticate to Unlock'}
            </h2>
            <div className="dim" style={{ fontSize: 12 }}>
              {isFirstRun
                ? 'Choose Open Mode or protect with User ID & Password.'
                : `Account: ${authStatus.username || 'admin'}`}
            </div>
          </div>
        </div>

        {err && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              background: 'rgba(229, 72, 77, 0.14)',
              border: '1px solid rgba(229, 72, 77, 0.4)',
              color: '#fb7185',
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
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                color: 'var(--fg)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <Lock size={18} color="#34d399" />
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Protect with User ID &amp; Password</div>
                <div className="dim" style={{ fontSize: 11, marginTop: 2 }}>
                  Create credentials to lock terminal, simulation, and host controls.
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
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: 'var(--fg)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <Unlock size={18} color="#38bdf8" />
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Keep Open (No Password)</div>
                <div className="dim" style={{ fontSize: 11, marginTop: 2 }}>
                  Enter directly. You can enable password protection anytime from the top bar.
                </div>
              </div>
            </button>
          </div>
        )}

        {isFirstRun && setupChoice === 'protected' && (
          <form onSubmit={handleProtectedSetup} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label className="dim" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>User ID (min 3 chars)</label>
              <input className="table-search" style={{ width: '100%' }} placeholder="e.g. admin" value={username} onChange={e => setUsername(e.target.value)} required />
            </div>
            <div>
              <label className="dim" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Password (min 6 chars)</label>
              <input type="password" className="table-search" style={{ width: '100%' }} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <div>
              <label className="dim" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Confirm Password</label>
              <input type="password" className="table-search" style={{ width: '100%' }} placeholder="••••••••" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} required />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <Btn type="button" variant="secondary" onClick={() => setSetupChoice('choose')}>Back</Btn>
              <Btn type="submit" variant="primary" loading={loading} style={{ flex: 1, justifyContent: 'center' }}>
                <CheckCircle2 size={14} /> Create &amp; Protect
              </Btn>
            </div>
          </form>
        )}

        {!isFirstRun && (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label className="dim" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>User ID</label>
              <input className="table-search" style={{ width: '100%' }} placeholder={authStatus.username || 'admin'} value={username} onChange={e => setUsername(e.target.value)} required />
            </div>
            <div>
              <label className="dim" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Password</label>
              <input type="password" className="table-search" style={{ width: '100%' }} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <Btn type="submit" variant="primary" loading={loading} style={{ justifyContent: 'center', marginTop: 4 }}>
              <KeyRound size={14} /> Unlock Guardian OS
            </Btn>
          </form>
        )}
      </div>
    </div>
  )
}
