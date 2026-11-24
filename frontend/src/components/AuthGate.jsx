import { useEffect, useRef, useState } from 'react'
import { Shield, Lock, Unlock, KeyRound, CheckCircle2, AlertTriangle, ChevronRight } from 'lucide-react'
import { api, setSessionToken } from '../api'
import { Btn } from './ui'

// Rich 3D Holographic Guardian OS Canvas (Dual Polyhedra + Gyroscope Rings + 3D Grid + Constellation)
function Guardian3DBackground({ mouseOffset }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId = 0
    let frame = 0

    const phi = (1 + Math.sqrt(5)) / 2
    const outerVerts = [
      [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
      [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
      [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1],
    ].map(([x, y, z]) => {
      const len = Math.hypot(x, y, z)
      return [x / len, y / len, z / len]
    })

    const outerEdges = [
      [0, 11], [0, 5], [0, 1], [0, 7], [0, 10],
      [1, 5], [5, 11], [11, 10], [10, 7], [7, 1],
      [3, 9], [3, 4], [3, 2], [3, 6], [3, 8],
      [4, 9], [9, 8], [8, 6], [6, 2], [2, 4],
      [1, 9], [5, 4], [11, 2], [10, 6], [7, 8],
      [9, 5], [4, 11], [2, 10], [6, 7], [8, 1],
    ]

    // Inner Octahedron Core
    const innerVerts = [
      [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
    ]
    const innerEdges = [
      [0, 2], [0, 3], [0, 4], [0, 5],
      [1, 2], [1, 3], [1, 4], [1, 5],
      [2, 4], [4, 3], [3, 5], [5, 2],
    ]

    // 3D Starfield Constellation
    const stars = Array.from({ length: 85 }, (_, i) => ({
      x: (((i * 73) % 440) - 220) / 80,
      y: (((i * 137) % 320) - 160) / 80,
      z: (((i * 53) % 320) - 160) / 80,
      r: (i % 3) + 1,
      hue: i % 2 === 0 ? '56, 189, 248' : '16, 185, 129',
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

      // Multi-stop Aurora Cyber Glow
      const aurora = ctx.createRadialGradient(w / 2, h * 0.42, 20, w / 2, h * 0.48, Math.max(w, h) * 0.72)
      aurora.addColorStop(0, 'rgba(16, 185, 129, 0.22)')
      aurora.addColorStop(0.38, 'rgba(56, 189, 248, 0.11)')
      aurora.addColorStop(0.7, 'rgba(167, 139, 250, 0.06)')
      aurora.addColorStop(1, 'rgba(8, 10, 15, 0)')
      ctx.fillStyle = aurora
      ctx.fillRect(0, 0, w, h)

      const t = frame * 0.007 + mouseOffset.current.x * 0.55
      const p = frame * 0.0045 + mouseOffset.current.y * 0.45
      const cosT = Math.cos(t)
      const sinT = Math.sin(t)
      const cosP = Math.cos(p)
      const sinP = Math.sin(p)

      const project = (x, y, z, scaleMul = 1, rotOffset = 0) => {
        const cT = rotOffset ? Math.cos(t * rotOffset) : cosT
        const sT = rotOffset ? Math.sin(t * rotOffset) : sinT
        const x1 = x * cT - z * sT
        const z1 = x * sT + z * cT
        const y2 = y * cosP - z1 * sinP
        const z2 = y * sinP + z1 * cosP + 4.3
        if (z2 <= 0.35) return null
        const s = (Math.min(w, h) * 0.55 * scaleMul) / z2
        return { x: w / 2 + x1 * s, y: h / 2 + y2 * s, z: z2 }
      }

      // 1. 3D Perspective Horizon Floor Grid
      ctx.save()
      ctx.lineWidth = 1
      const gridY = 1.95
      const gRange = 5.5
      for (let gx = -gRange; gx <= gRange; gx += 0.65) {
        const pA = project(gx, gridY, -gRange, 1.15)
        const pB = project(gx, gridY, gRange, 1.15)
        if (pA && pB) {
          ctx.beginPath()
          ctx.moveTo(pA.x, pA.y)
          ctx.lineTo(pB.x, pB.y)
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.065)'
          ctx.stroke()
        }
      }
      for (let gz = -gRange; gz <= gRange; gz += 0.65) {
        const pA = project(-gRange, gridY, gz, 1.15)
        const pB = project(gRange, gridY, gz, 1.15)
        if (pA && pB) {
          ctx.beginPath()
          ctx.moveTo(pA.x, pA.y)
          ctx.lineTo(pB.x, pB.y)
          ctx.strokeStyle = 'rgba(16, 185, 129, 0.065)'
          ctx.stroke()
        }
      }
      ctx.restore()

      // 2. 3D Constellation Starfield
      const projStars = stars.map(st => ({ ...st, pr: project(st.x, st.y, st.z, 1.35) })).filter(s => s.pr)
      projStars.forEach((st, idx) => {
        ctx.beginPath()
        ctx.arc(st.pr.x, st.pr.y, st.r * 0.9, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${st.hue}, 0.36)`
        ctx.fill()

        if (idx % 3 === 0 && projStars[idx + 1]) {
          const nxt = projStars[idx + 1]
          const dist = Math.hypot(st.pr.x - nxt.pr.x, st.pr.y - nxt.pr.y)
          if (dist < 140) {
            ctx.beginPath()
            ctx.moveTo(st.pr.x, st.pr.y)
            ctx.lineTo(nxt.pr.x, nxt.pr.y)
            ctx.strokeStyle = `rgba(${st.hue}, 0.09)`
            ctx.lineWidth = 0.8
            ctx.stroke()
          }
        }
      })

      // 3. 3D Gyroscope Orbital Rings + Orbiting Energy Nodes
      const ringConfigs = [
        { rad: 1.65, tiltX: 0.45, color: 'rgba(16, 185, 129, 0.32)', speed: 0.02 },
        { rad: 1.95, tiltX: -0.58, color: 'rgba(56, 189, 248, 0.28)', speed: -0.016 },
        { rad: 2.22, tiltX: 0.18, color: 'rgba(167, 139, 250, 0.22)', speed: 0.012 },
      ]
      ringConfigs.forEach(rc => {
        ctx.beginPath()
        for (let a = 0; a <= 72; a++) {
          const ang = (a / 72) * Math.PI * 2
          const rx = Math.cos(ang) * rc.rad
          const ry = Math.sin(ang) * rc.rad * rc.tiltX
          const rz = Math.sin(ang) * rc.rad
          const pr = project(rx, ry, rz)
          if (!pr) continue
          if (a === 0) ctx.moveTo(pr.x, pr.y)
          else ctx.lineTo(pr.x, pr.y)
        }
        ctx.strokeStyle = rc.color
        ctx.lineWidth = 1.3
        ctx.stroke()

        // Orbiting glowing energy orb
        const orbAng = frame * rc.speed
        const orbPr = project(Math.cos(orbAng) * rc.rad, Math.sin(orbAng) * rc.rad * rc.tiltX, Math.sin(orbAng) * rc.rad)
        if (orbPr) {
          ctx.beginPath()
          ctx.arc(orbPr.x, orbPr.y, 4, 0, Math.PI * 2)
          ctx.fillStyle = '#ffffff'
          ctx.shadowColor = '#34d399'
          ctx.shadowBlur = 14
          ctx.fill()
          ctx.shadowBlur = 0
        }
      })

      // 4. Outer Icosahedron Wireframe
      const projOuter = outerVerts.map(v => project(v[0] * 1.25, v[1] * 1.25, v[2] * 1.25))
      outerEdges.forEach(([a, b]) => {
        const pa = projOuter[a]
        const pb = projOuter[b]
        if (!pa || !pb) return
        ctx.beginPath()
        ctx.moveTo(pa.x, pa.y)
        ctx.lineTo(pb.x, pb.y)
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.36)'
        ctx.lineWidth = 1.4
        ctx.stroke()
      })
      projOuter.forEach(pv => {
        if (!pv) return
        ctx.beginPath()
        ctx.arc(pv.x, pv.y, 3.2, 0, Math.PI * 2)
        ctx.fillStyle = '#38bdf8'
        ctx.shadowColor = '#38bdf8'
        ctx.shadowBlur = 8
        ctx.fill()
        ctx.shadowBlur = 0
      })

      // 5. Inner Counter-Rotating Pulsing Core
      const pulse = 0.68 + Math.sin(frame * 0.04) * 0.06
      const projInner = innerVerts.map(v => project(v[0] * pulse, v[1] * pulse, v[2] * pulse, 1, -1.4))
      innerEdges.forEach(([a, b]) => {
        const pa = projInner[a]
        const pb = projInner[b]
        if (!pa || !pb) return
        ctx.beginPath()
        ctx.moveTo(pa.x, pa.y)
        ctx.lineTo(pb.x, pb.y)
        ctx.strokeStyle = 'rgba(167, 139, 250, 0.55)'
        ctx.lineWidth = 1.6
        ctx.stroke()
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
  const [hoveredChoice, setHoveredChoice] = useState('')
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
    setTilt({ rx: -ny * 6, ry: nx * 6 })
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
        background: 'radial-gradient(circle at 50% 35%, #111827 0%, #07090e 100%)',
        color: 'var(--fg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        perspective: 1200,
        overflow: 'hidden',
      }}
    >
      <style>{`
        @keyframes guardianSlideUp {
          from { opacity: 0; transform: translateY(14px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .guardian-fluid-panel {
          animation: guardianSlideUp 0.38s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .guardian-choice-btn {
          transition: transform 0.24s cubic-bezier(0.22, 1, 0.36, 1),
                      border-color 0.24s ease,
                      box-shadow 0.24s ease,
                      background 0.24s ease;
        }
        .guardian-choice-btn:hover {
          transform: translateY(-3px) scale(1.015);
        }
      `}</style>

      <Guardian3DBackground mouseOffset={mouseOffset} />

      {/* 3D Layered "GUARDIAN OS" Hero Typography */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          textAlign: 'center',
          marginBottom: 24,
          transform: `rotateX(${tilt.rx * 0.7}deg) rotateY(${tilt.ry * 0.7}deg) translateZ(24px)`,
          transition: 'transform 0.14s ease-out',
        }}
      >
        <div
          className="mono"
          style={{
            fontSize: 34,
            fontWeight: 800,
            letterSpacing: '0.16em',
            background: 'linear-gradient(135deg, #34d399 0%, #38bdf8 50%, #c084fc 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 6px 18px rgba(16, 185, 129, 0.35))',
          }}
        >
          GUARDIAN OS
        </div>
        <div className="mono" style={{ fontSize: 11, color: '#94a3b8', letterSpacing: '0.2em', marginTop: 4 }}>
          KERNEL TELEMETRY &amp; INTRUSION DEFENSE
        </div>
      </div>

      {/* 3D Tilted Frosted Glass Card */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          width: 'min(460px, 95vw)',
          padding: 28,
          borderRadius: 18,
          background: 'rgba(15, 18, 26, 0.74)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.16), 0 28px 70px rgba(0, 0, 0, 0.68)',
          transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
          transition: 'transform 0.14s ease-out',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 11,
              background: 'linear-gradient(135deg, rgba(16,185,129,0.22), rgba(56,189,248,0.14))',
              border: '1px solid rgba(16, 185, 129, 0.42)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#34d399',
              boxShadow: '0 0 18px rgba(16, 185, 129, 0.25)',
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
            className="guardian-fluid-panel"
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              background: 'rgba(229, 72, 77, 0.14)',
              border: '1px solid rgba(229, 72, 77, 0.42)',
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
          <div key="choose" className="guardian-fluid-panel" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              onClick={() => setSetupChoice('protected')}
              onMouseEnter={() => setHoveredChoice('protected')}
              onMouseLeave={() => setHoveredChoice('')}
              className="guardian-choice-btn"
              style={{
                textAlign: 'left',
                padding: 15,
                borderRadius: 12,
                background: hoveredChoice === 'protected' ? 'rgba(16, 185, 129, 0.14)' : 'rgba(16, 185, 129, 0.08)',
                border: `1px solid ${hoveredChoice === 'protected' ? 'rgba(16, 185, 129, 0.7)' : 'rgba(16, 185, 129, 0.35)'}`,
                boxShadow: hoveredChoice === 'protected' ? '0 10px 26px rgba(16, 185, 129, 0.18)' : 'none',
                color: 'var(--fg)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Lock size={19} color="#34d399" />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>Protect with User ID &amp; Password</div>
                  <div className="dim" style={{ fontSize: 11, marginTop: 2 }}>
                    Lock terminal, simulation, and host controls with PBKDF2 security.
                  </div>
                </div>
              </div>
              <ChevronRight
                size={16}
                color="#34d399"
                style={{
                  transform: hoveredChoice === 'protected' ? 'translateX(4px)' : 'translateX(0)',
                  transition: 'transform 0.2s ease',
                  flexShrink: 0,
                }}
              />
            </button>

            <button
              onClick={chooseOpenMode}
              onMouseEnter={() => setHoveredChoice('open')}
              onMouseLeave={() => setHoveredChoice('')}
              disabled={loading}
              className="guardian-choice-btn"
              style={{
                textAlign: 'left',
                padding: 15,
                borderRadius: 12,
                background: hoveredChoice === 'open' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                border: `1px solid ${hoveredChoice === 'open' ? 'rgba(56, 189, 248, 0.6)' : 'rgba(255, 255, 255, 0.12)'}`,
                boxShadow: hoveredChoice === 'open' ? '0 10px 26px rgba(56, 189, 248, 0.14)' : 'none',
                color: 'var(--fg)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Unlock size={19} color="#38bdf8" />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>Keep Open (No Password)</div>
                  <div className="dim" style={{ fontSize: 11, marginTop: 2 }}>
                    Enter directly. You can enable password protection anytime from the top bar.
                  </div>
                </div>
              </div>
              <ChevronRight
                size={16}
                color="#38bdf8"
                style={{
                  transform: hoveredChoice === 'open' ? 'translateX(4px)' : 'translateX(0)',
                  transition: 'transform 0.2s ease',
                  flexShrink: 0,
                }}
              />
            </button>
          </div>
        )}

        {isFirstRun && setupChoice === 'protected' && (
          <form key="protected-form" onSubmit={handleProtectedSetup} className="guardian-fluid-panel" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
          <form key="login-form" onSubmit={handleLogin} className="guardian-fluid-panel" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
