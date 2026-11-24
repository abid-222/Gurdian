import { useEffect, useRef, useState, useCallback } from 'react'
import { Rotate3d, Maximize2, Layers, Box } from 'lucide-react'

const MODE_THEME = {
  idle: {
    bgGlow: 'rgba(56, 189, 248, 0.12)',
    bannerBg: 'rgba(56, 189, 248, 0.12)',
    bannerBorder: 'rgba(56, 189, 248, 0.35)',
    bannerColor: '#38bdf8',
    bannerText: 'SYSTEM IDLE — Processes & Mutex Locks Ready for Simulation',
  },
  deadlock: {
    bgGlow: 'rgba(244, 63, 94, 0.18)',
    bannerBg: 'rgba(244, 63, 94, 0.16)',
    bannerBorder: 'rgba(244, 63, 94, 0.50)',
    bannerColor: '#fb7185',
    bannerText: 'CIRCULAR WAIT DEADLOCK — Mutual Hold & Wait Cycle Detected!',
  },
  prevented: {
    bgGlow: 'rgba(16, 185, 129, 0.16)',
    bannerBg: 'rgba(16, 185, 129, 0.14)',
    bannerBorder: 'rgba(16, 185, 129, 0.45)',
    bannerColor: '#34d399',
    bannerText: 'DEADLOCK PREVENTED — Strict Lock Hierarchy F(R_1) < F(R_2) < ... Enforced',
  },
  resolved: {
    bgGlow: 'rgba(245, 158, 11, 0.14)',
    bannerBg: 'rgba(245, 158, 11, 0.15)',
    bannerBorder: 'rgba(245, 158, 11, 0.45)',
    bannerColor: '#fbbf24',
    bannerText: 'DEADLOCK BROKEN — Victim Preempted, Resources Freed for Survivor',
  },
}

// Interactive 3D / 2.5D Resource Allocation Graph (RAG) — supports OS Kernel & Custom PC Sandbox
export default function Deadlock3D({
  mode = 'idle', // 'idle' | 'deadlock' | 'prevented' | 'resolved'
  p1State = null,
  p2State = null,
  cycle = null,
  customNodes = null, // Optional: [{ id, short, type: 'process'|'resource', label, sub }]
  customEdges = null, // Optional: [{ from, to, kind: 'hold'|'wait'|'order'|'idle', label }]
  className = '',
  height = 460,
}) {
  const canvasRef = useRef(null)
  const animRef = useRef(null)
  const [isFlat2D, setIsFlat2D] = useState(false)

  const cameraRef = useRef({
    theta: 0.0,
    phi: 0.34,
    dist: 410,
    isDragging: false,
    lastX: 0,
    lastY: 0,
  })

  const [cameraDisplay, setCameraDisplay] = useState({ theta: 0, phi: 20 })

  const toggleViewMode = () => {
    setIsFlat2D(prev => {
      const next = !prev
      if (next) {
        cameraRef.current.theta = 0
        cameraRef.current.phi = 0
        cameraRef.current.dist = 390
        setCameraDisplay({ theta: 0, phi: 0 })
      } else {
        cameraRef.current.theta = 0
        cameraRef.current.phi = 0.34
        cameraRef.current.dist = 410
        setCameraDisplay({ theta: 0, phi: 20 })
      }
      return next
    })
  }

  const getNodes = useCallback(() => {
    const isDeadlock = mode === 'deadlock'
    const isPrevented = mode === 'prevented'
    const isResolved = mode === 'resolved'
    const cycleSet = new Set(Array.isArray(cycle) ? cycle : [])

    // Dynamic layout when customNodes are provided (Real PC / Custom Builder mode)
    if (Array.isArray(customNodes) && customNodes.length > 0) {
      const procs = customNodes.filter(n => n.type === 'process')
      const ress = customNodes.filter(n => n.type === 'resource')

      const positioned = []
      const pCount = Math.max(procs.length, 1)
      procs.forEach((p, idx) => {
        const angle = (idx / pCount) * Math.PI * 2 - Math.PI / 2
        const rx = procs.length <= 2 ? (idx === 0 ? -145 : 145) : Math.cos(angle) * 165
        const rz = procs.length <= 2 ? 0 : Math.sin(angle) * 95
        const ry = procs.length <= 2 ? 10 : Math.sin(angle) * 35
        const inCycle = cycleSet.has(p.id)
        positioned.push({
          ...p,
          x: rx,
          y: ry,
          z: rz,
          color: inCycle ? '#f43f5e' : isPrevented ? '#10b981' : isResolved && p.preempted ? '#94a3b8' : '#38bdf8',
          glow: inCycle ? 'rgba(244, 63, 94, 0.6)' : isPrevented ? 'rgba(16, 185, 129, 0.5)' : 'rgba(56, 189, 248, 0.45)',
          isCycle: inCycle,
        })
      })

      const rCount = Math.max(ress.length, 1)
      ress.forEach((r, idx) => {
        const rx = ress.length === 1 ? 0 : (idx - (rCount - 1) / 2) * 120
        const ry = idx % 2 === 0 ? 105 : -90
        const rz = idx % 2 === 0 ? -45 : 45
        const inCycle = cycleSet.has(r.id)
        positioned.push({
          ...r,
          x: rx,
          y: ry,
          z: rz,
          color: inCycle ? '#f59e0b' : isPrevented ? '#10b981' : '#a78bfa',
          glow: inCycle ? 'rgba(245, 158, 11, 0.55)' : isPrevented ? 'rgba(16, 185, 129, 0.45)' : 'rgba(167, 139, 250, 0.45)',
          isCycle: inCycle,
        })
      })

      return positioned
    }

    // Default OS Kernel Lab 4-node layout
    return [
      {
        id: 'P1',
        short: 'P1',
        type: 'process',
        label: p1State?.pid ? `P1 · PID ${p1State.pid}` : 'Process P1',
        sub: p1State?.state || (isDeadlock ? 'BLOCKED (Waiting R_B)' : isPrevented ? 'COMPLETED' : isResolved ? 'UNBLOCKED & DONE' : 'READY'),
        x: -140,
        y: 10,
        z: 0,
        color: isDeadlock ? '#f43f5e' : isPrevented || isResolved ? '#10b981' : '#38bdf8',
        glow: isDeadlock ? 'rgba(244, 63, 94, 0.55)' : isPrevented || isResolved ? 'rgba(16, 185, 129, 0.5)' : 'rgba(56, 189, 248, 0.45)',
        isCycle: isDeadlock,
      },
      {
        id: 'P2',
        short: 'P2',
        type: 'process',
        label: p2State?.pid ? `P2 · PID ${p2State.pid}` : 'Process P2',
        sub: p2State?.state || (isDeadlock ? 'BLOCKED (Waiting R_A)' : isPrevented ? 'COMPLETED' : isResolved ? 'PREEMPTED (KILLED)' : 'READY'),
        x: 140,
        y: 10,
        z: 0,
        color: isDeadlock ? '#f43f5e' : isPrevented ? '#10b981' : isResolved ? '#94a3b8' : '#38bdf8',
        glow: isDeadlock ? 'rgba(244, 63, 94, 0.55)' : isPrevented ? 'rgba(16, 185, 129, 0.5)' : isResolved ? 'rgba(148, 163, 184, 0.25)' : 'rgba(56, 189, 248, 0.45)',
        isCycle: isDeadlock,
      },
      {
        id: 'RA',
        short: 'R_A',
        type: 'resource',
        label: isPrevented ? 'Resource R_A (Rank #1)' : 'Resource R_A',
        sub: 'flock fd:200 · /tmp',
        x: 0,
        y: 100,
        z: -55,
        color: isDeadlock ? '#f59e0b' : isPrevented ? '#10b981' : '#a78bfa',
        glow: isDeadlock ? 'rgba(245, 158, 11, 0.5)' : isPrevented ? 'rgba(16, 185, 129, 0.45)' : 'rgba(167, 139, 250, 0.45)',
        isCycle: isDeadlock,
      },
      {
        id: 'RB',
        short: 'R_B',
        type: 'resource',
        label: isPrevented ? 'Resource R_B (Rank #2)' : 'Resource R_B',
        sub: 'flock fd:201 · /tmp',
        x: 0,
        y: -80,
        z: 55,
        color: isDeadlock ? '#f59e0b' : isPrevented ? '#10b981' : '#a78bfa',
        glow: isDeadlock ? 'rgba(245, 158, 11, 0.5)' : isPrevented ? 'rgba(16, 185, 129, 0.45)' : 'rgba(167, 139, 250, 0.45)',
        isCycle: isDeadlock,
      },
    ]
  }, [mode, p1State, p2State, customNodes, cycle])

  const getEdges = useCallback(() => {
    if (Array.isArray(customEdges)) {
      return customEdges
    }
    if (mode === 'deadlock') {
      return [
        { from: 'RA', to: 'P1', kind: 'hold', label: 'HOLDS R_A' },
        { from: 'P1', to: 'RB', kind: 'wait', label: 'WAITS FOR R_B' },
        { from: 'RB', to: 'P2', kind: 'hold', label: 'HOLDS R_B' },
        { from: 'P2', to: 'RA', kind: 'wait', label: 'WAITS FOR R_A' },
      ]
    }
    if (mode === 'prevented') {
      return [
        { from: 'RA', to: 'P1', kind: 'hold', label: '1st: Rank #1' },
        { from: 'RB', to: 'P1', kind: 'hold', label: '2nd: Rank #2' },
        { from: 'RA', to: 'P2', kind: 'order', label: 'Ordered Safe' },
      ]
    }
    if (mode === 'resolved') {
      return [
        { from: 'RA', to: 'P1', kind: 'hold', label: 'ACQUIRED' },
        { from: 'RB', to: 'P1', kind: 'hold', label: 'PREEMPTED -> P1' },
      ]
    }
    return [
      { from: 'P1', to: 'RA', kind: 'idle', label: 'Can Request' },
      { from: 'P2', to: 'RB', kind: 'idle', label: 'Can Request' },
    ]
  }, [mode, customEdges])

  const handleMouseDown = e => {
    if (isFlat2D) return
    cameraRef.current.isDragging = true
    cameraRef.current.lastX = e.clientX
    cameraRef.current.lastY = e.clientY
  }

  const handleMouseMove = e => {
    if (!cameraRef.current.isDragging || isFlat2D) return
    const dx = e.clientX - cameraRef.current.lastX
    const dy = e.clientY - cameraRef.current.lastY
    cameraRef.current.lastX = e.clientX
    cameraRef.current.lastY = e.clientY

    cameraRef.current.theta += dx * 0.008
    cameraRef.current.phi = Math.max(-0.35, Math.min(1.2, cameraRef.current.phi - dy * 0.008))

    setCameraDisplay({
      theta: Math.round(((cameraRef.current.theta * 180) / Math.PI) % 360),
      phi: Math.round((cameraRef.current.phi * 180) / Math.PI),
    })
  }

  const handleMouseUp = () => {
    cameraRef.current.isDragging = false
  }

  const handleWheel = e => {
    e.preventDefault()
    cameraRef.current.dist = Math.max(240, Math.min(640, cameraRef.current.dist + e.deltaY * 0.35))
  }

  const resetView = () => {
    setIsFlat2D(false)
    cameraRef.current.theta = 0.0
    cameraRef.current.phi = 0.34
    cameraRef.current.dist = 410
    setCameraDisplay({ theta: 0, phi: 20 })
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let frame = 0

    const theme = MODE_THEME[mode] || MODE_THEME.idle

    const render = () => {
      frame++
      const width = canvas.clientWidth
      const heightVal = canvas.clientHeight
      if (canvas.width !== width || canvas.height !== heightVal) {
        canvas.width = width
        canvas.height = heightVal
      }

      ctx.clearRect(0, 0, width, heightVal)

      const bgGrad = ctx.createRadialGradient(
        width / 2,
        heightVal / 2,
        24,
        width / 2,
        heightVal / 2,
        Math.max(width, heightVal) * 0.65
      )
      bgGrad.addColorStop(0, theme.bgGlow)
      bgGrad.addColorStop(1, 'rgba(10, 11, 16, 0)')
      ctx.fillStyle = bgGrad
      ctx.fillRect(0, 0, width, heightVal)

      const cx = width / 2
      const cy = heightVal / 2 + 12
      const fov = 365
      const cam = cameraRef.current

      const cosT = Math.cos(cam.theta)
      const sinT = Math.sin(cam.theta)
      const cosP = Math.cos(cam.phi)
      const sinP = Math.sin(cam.phi)

      const project3D = (x, y, z) => {
        const x1 = x * cosT - z * sinT
        const z1 = x * sinT + z * cosT
        const y2 = y * cosP - z1 * sinP
        const z2 = y * sinP + z1 * cosP + cam.dist
        if (z2 <= 30) return null
        const scale = fov / z2
        return { x: cx + x1 * scale, y: cy - y2 * scale, z: z2, scale }
      }

      if (!isFlat2D) {
        ctx.lineWidth = 1
        const gridSize = 180
        const gridStep = 45
        for (let gx = -gridSize; gx <= gridSize; gx += gridStep) {
          const pA = project3D(gx, -115, -gridSize)
          const pB = project3D(gx, -115, gridSize)
          if (pA && pB) {
            ctx.beginPath()
            ctx.moveTo(pA.x, pA.y)
            ctx.lineTo(pB.x, pB.y)
            ctx.strokeStyle = gx === 0 ? 'rgba(255, 255, 255, 0.11)' : 'rgba(255, 255, 255, 0.035)'
            ctx.stroke()
          }
        }
        for (let gz = -gridSize; gz <= gridSize; gz += gridStep) {
          const pA = project3D(-gridSize, -115, gz)
          const pB = project3D(gridSize, -115, gz)
          if (pA && pB) {
            ctx.beginPath()
            ctx.moveTo(pA.x, pA.y)
            ctx.lineTo(pB.x, pB.y)
            ctx.strokeStyle = gz === 0 ? 'rgba(255, 255, 255, 0.11)' : 'rgba(255, 255, 255, 0.035)'
            ctx.stroke()
          }
        }
      }

      const nodes = getNodes()
      const edges = getEdges()
      const nodeMap = {}

      const projectedNodes = nodes.map(n => {
        const proj = project3D(n.x, n.y, n.z)
        const item = { ...n, proj }
        nodeMap[n.id] = item
        return item
      })

      edges.forEach((edge, eIdx) => {
        const source = nodeMap[edge.from]
        const target = nodeMap[edge.to]
        if (!source?.proj || !target?.proj) return

        const pA = source.proj
        const pB = target.proj

        const isWait = edge.kind === 'wait'
        const isHold = edge.kind === 'hold'
        const isOrder = edge.kind === 'order'

        let strokeColor = 'rgba(148, 163, 184, 0.5)'
        if (isWait) strokeColor = '#f43f5e'
        else if (isHold) strokeColor = '#10b981'
        else if (isOrder) strokeColor = '#38bdf8'

        const dx = pB.x - pA.x
        const dy = pB.y - pA.y
        const len = Math.hypot(dx, dy) || 1
        const nx = -dy / len
        const ny = dx / len
        const curveOffset = isWait ? 30 : isHold ? -22 : 16
        const midX = (pA.x + pB.x) / 2 + nx * curveOffset
        const midY = (pA.y + pB.y) / 2 + ny * curveOffset

        ctx.save()
        ctx.beginPath()
        ctx.moveTo(pA.x, pA.y)
        ctx.quadraticCurveTo(midX, midY, pB.x, pB.y)
        ctx.strokeStyle = strokeColor
        ctx.lineWidth = isWait ? 3.2 : isHold ? 2.6 : 1.8
        if (isWait) {
          ctx.setLineDash([8, 6])
          ctx.lineDashOffset = -frame * 0.65
        }
        ctx.shadowColor = strokeColor
        ctx.shadowBlur = isWait ? 12 : isHold ? 8 : 0
        ctx.stroke()
        ctx.restore()

        const packetCount = isWait ? 3 : 2
        for (let i = 0; i < packetCount; i++) {
          const t = (frame * 0.012 + i / packetCount + eIdx * 0.2) % 1
          const inv = 1 - t
          const px = inv * inv * pA.x + 2 * inv * t * midX + t * t * pB.x
          const py = inv * inv * pA.y + 2 * inv * t * midY + t * t * pB.y

          ctx.beginPath()
          ctx.arc(px, py, isWait ? 4.2 : 3.2, 0, Math.PI * 2)
          ctx.fillStyle = '#ffffff'
          ctx.shadowColor = strokeColor
          ctx.shadowBlur = 10
          ctx.fill()
          ctx.shadowBlur = 0
        }

        const targetRadius = (target.type === 'process' ? 28 : 24) * pB.scale
        const arrowT = Math.max(0.65, 1 - (targetRadius + 8) / len)
        const invA = 1 - arrowT
        const arrowX = invA * invA * pA.x + 2 * invA * arrowT * midX + arrowT * arrowT * pB.x
        const arrowY = invA * invA * pA.y + 2 * invA * arrowT * midY + arrowT * arrowT * pB.y
        const tx = 2 * invA * (midX - pA.x) + 2 * arrowT * (pB.x - midX)
        const ty = 2 * invA * (midY - pA.y) + 2 * arrowT * (pB.y - midY)
        const angle = Math.atan2(ty, tx)

        ctx.beginPath()
        ctx.moveTo(arrowX, arrowY)
        ctx.lineTo(arrowX - 11 * Math.cos(angle - Math.PI / 6), arrowY - 11 * Math.sin(angle - Math.PI / 6))
        ctx.lineTo(arrowX - 11 * Math.cos(angle + Math.PI / 6), arrowY - 11 * Math.sin(angle + Math.PI / 6))
        ctx.closePath()
        ctx.fillStyle = strokeColor
        ctx.fill()

        if (edge.label) {
          const lx = 0.25 * pA.x + 0.5 * midX + 0.25 * pB.x
          const ly = 0.25 * pA.y + 0.5 * midY + 0.25 * pB.y
          ctx.font = '600 10px "JetBrains Mono", monospace'
          const tw = ctx.measureText(edge.label).width
          ctx.fillStyle = 'rgba(13, 15, 22, 0.92)'
          ctx.strokeStyle = strokeColor
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.roundRect(lx - tw / 2 - 7, ly - 9, tw + 14, 18, 9)
          ctx.fill()
          ctx.stroke()
          ctx.fillStyle = strokeColor
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(edge.label, lx, ly)
          ctx.textBaseline = 'alphabetic'
        }
      })

      const sortedNodes = [...projectedNodes]
        .filter(n => n.proj !== null)
        .sort((a, b) => b.proj.z - a.proj.z)

      sortedNodes.forEach(n => {
        const { x, y, scale } = n.proj
        const isProcess = n.type === 'process'
        const radius = (isProcess ? 28 : 24) * scale

        if (!isFlat2D) {
          const floorProj = project3D(n.x, -115, n.z)
          if (floorProj) {
            ctx.beginPath()
            ctx.ellipse(floorProj.x, floorProj.y, radius * 0.85, radius * 0.36, 0, 0, Math.PI * 2)
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
            ctx.fill()

            ctx.beginPath()
            ctx.moveTo(x, y + radius)
            ctx.lineTo(floorProj.x, floorProj.y)
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
            ctx.lineWidth = 1
            ctx.setLineDash([3, 4])
            ctx.stroke()
            ctx.setLineDash([])
          }
        }

        if (n.isCycle) {
          const pulse = Math.sin(frame * 0.08) * 5
          ctx.beginPath()
          ctx.arc(x, y, radius + 10 + pulse, 0, Math.PI * 2)
          ctx.strokeStyle = 'rgba(244, 63, 94, 0.5)'
          ctx.lineWidth = 2.5
          ctx.stroke()
        }

        ctx.save()
        ctx.shadowColor = n.glow
        ctx.shadowBlur = 18

        if (isProcess) {
          ctx.beginPath()
          ctx.arc(x, y, radius, 0, Math.PI * 2)
          const grad = ctx.createRadialGradient(
            x - radius * 0.35,
            y - radius * 0.35,
            radius * 0.1,
            x,
            y,
            radius
          )
          grad.addColorStop(0, '#323442')
          grad.addColorStop(0.55, '#191b24')
          grad.addColorStop(1, n.color + '44')
          ctx.fillStyle = grad
          ctx.fill()
          ctx.strokeStyle = n.color
          ctx.lineWidth = 3
          ctx.stroke()
        } else {
          const s = radius * 0.92
          ctx.beginPath()
          ctx.roundRect(x - s, y - s, s * 2, s * 2, 10 * scale)
          const grad = ctx.createLinearGradient(x - s, y - s, x + s, y + s)
          grad.addColorStop(0, '#2a2b3a')
          grad.addColorStop(1, n.color + '40')
          ctx.fillStyle = grad
          ctx.fill()
          ctx.strokeStyle = n.color
          ctx.lineWidth = 2.8
          ctx.stroke()
        }
        ctx.restore()

        ctx.font = `700 ${Math.max(11, Math.round(13 * scale))}px "JetBrains Mono", monospace`
        ctx.fillStyle = '#ffffff'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText((n.short || n.id).slice(0, 7), x, y)
        ctx.textBaseline = 'alphabetic'

        ctx.font = `600 ${Math.max(10, Math.round(11 * scale))}px "JetBrains Mono", monospace`
        ctx.fillStyle = '#f4f4f5'
        ctx.fillText(n.label, x, y - radius - 10)

        ctx.font = `600 ${Math.max(9, Math.round(10 * scale))}px "JetBrains Mono", monospace`
        ctx.fillStyle = n.color
        ctx.fillText(n.sub, x, y + radius + 16)
      })

      animRef.current = requestAnimationFrame(render)
    }

    render()

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [getNodes, getEdges, mode, isFlat2D])

  const theme = MODE_THEME[mode] || MODE_THEME.idle
  const bannerLabel =
    mode === 'deadlock' && Array.isArray(cycle) && cycle.length > 1
      ? `CYCLE DETECTED: ${cycle.join(' → ')}`
      : theme.bannerText

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        height,
        borderRadius: 14,
        border: `1px solid ${theme.bannerBorder}`,
        background: 'rgba(13, 15, 22, 0.72)',
        backdropFilter: 'blur(18px)',
        overflow: 'hidden',
        userSelect: 'none',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 12px 32px rgba(0, 0, 0, 0.5)',
      }}
    >
      {/* Top Status Banner */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          right: 215,
          zIndex: 4,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '7px 12px',
          borderRadius: 9,
          background: theme.bannerBg,
          border: `1px solid ${theme.bannerBorder}`,
          color: theme.bannerColor,
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: 11,
          fontWeight: 600,
          backdropFilter: 'blur(10px)',
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: theme.bannerColor,
            boxShadow: `0 0 8px ${theme.bannerColor}`,
            flexShrink: 0,
          }}
        />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {bannerLabel}
        </span>
      </div>

      {/* Top-Right Camera & 2D/3D Controls */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          zIndex: 4,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 10px',
          borderRadius: 9,
          background: 'rgba(20, 22, 30, 0.78)',
          border: '1px solid rgba(255, 255, 255, 0.14)',
          color: 'var(--text-secondary)',
          fontSize: 11,
          backdropFilter: 'blur(10px)',
        }}
      >
        <button
          onClick={toggleViewMode}
          title={isFlat2D ? 'Switch to 3D Orbit View' : 'Switch to Flat 2D Diagram'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            background: isFlat2D ? 'rgba(56, 189, 248, 0.18)' : 'rgba(16, 185, 129, 0.16)',
            color: isFlat2D ? '#38bdf8' : '#34d399',
            border: `1px solid ${isFlat2D ? 'rgba(56, 189, 248, 0.35)' : 'rgba(16, 185, 129, 0.35)'}`,
            borderRadius: 6,
            padding: '2px 8px',
            fontSize: 10,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {isFlat2D ? <Layers size={12} /> : <Box size={12} />}
          {isFlat2D ? '2D Flat' : '3D Orbit'}
        </button>
        <Rotate3d size={13} color="var(--accent)" />
        <span className="mono" style={{ fontSize: 10 }}>
          {cameraDisplay.theta}° / {cameraDisplay.phi}°
        </span>
        <button
          onClick={resetView}
          title="Reset Camera Angle"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--fg)',
            cursor: 'pointer',
            padding: 2,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Maximize2 size={12} />
        </button>
      </div>

      {/* Main Canvas */}
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          cursor: isFlat2D ? 'default' : 'grab',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />

      {/* Bottom Legend Bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 10,
          left: 12,
          right: 12,
          zIndex: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
          padding: '7px 12px',
          borderRadius: 9,
          background: 'rgba(18, 20, 28, 0.78)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          fontSize: 11,
          color: 'var(--text-secondary)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 6px #38bdf8' }} />
            Process (Sphere)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: '#a78bfa', boxShadow: '0 0 6px #a78bfa' }} />
            Resource Lock (Vault)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 14, height: 3, borderRadius: 2, background: '#10b981' }} />
            Holding Edge (R → P)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 14, height: 3, borderRadius: 2, background: '#f43f5e' }} />
            Waiting Edge (P → R)
          </span>
        </div>
        <span className="mono" style={{ fontSize: 10, color: 'var(--dim)' }}>
          {isFlat2D ? 'Clean 2D Diagram Mode' : 'Drag to Rotate · Scroll to Zoom'}
        </span>
      </div>
    </div>
  )
}
