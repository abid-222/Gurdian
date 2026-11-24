import { useEffect, useRef, useState, useCallback } from 'react'
import { Rotate3d, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'

// True 3D Mathematical Projection Engine for Resource Allocation Graph (RAG)
export default function Deadlock3D({
  mode = 'idle', // 'idle' | 'deadlock' | 'prevented' | 'resolved'
  p1State = null,
  p2State = null,
  cycle = null,
  className = '',
  height = 420
}) {
  const canvasRef = useRef(null)
  const animRef = useRef(null)

  // Camera 3D Orbit state
  const cameraRef = useRef({
    theta: 0.75, // Horizontal azimuth (radians)
    phi: 0.45,   // Elevation angle (radians)
    dist: 380,   // Distance from origin
    isDragging: false,
    lastX: 0,
    lastY: 0
  })

  const [cameraDisplay, setCameraDisplay] = useState({ theta: 43, phi: 26 })

  // 3D Nodes Definition
  // Coordinates in 3D world space (X: left/right, Y: up/down, Z: forward/back)
  const getNodes = useCallback(() => {
    const isDeadlock = mode === 'deadlock'
    const isPrevented = mode === 'prevented'
    const isResolved = mode === 'resolved'

    return [
      {
        id: 'P1',
        type: 'process',
        label: p1State?.pid ? `P1 (PID ${p1State.pid})` : 'Process P1',
        sub: p1State?.state || (isDeadlock ? 'BLOCKED' : isPrevented ? 'COMPLETED' : 'IDLE'),
        x: -120,
        y: 40,
        z: 0,
        color: isDeadlock ? '#f43f5e' : isPrevented ? '#10b981' : isResolved ? '#10b981' : '#3b82f6',
        isCycle: isDeadlock
      },
      {
        id: 'P2',
        type: 'process',
        label: p2State?.pid ? `P2 (PID ${p2State.pid})` : 'Process P2',
        sub: p2State?.state || (isDeadlock ? 'BLOCKED' : isPrevented ? 'COMPLETED' : isResolved ? 'PREEMPTED' : 'IDLE'),
        x: 120,
        y: 40,
        z: 0,
        color: isDeadlock ? '#f43f5e' : isPrevented ? '#10b981' : isResolved ? '#64748b' : '#3b82f6',
        isCycle: isDeadlock
      },
      {
        id: 'RA',
        type: 'resource',
        label: 'Resource R_A',
        sub: 'Lock fd:200 (/tmp)',
        x: 0,
        y: 110,
        z: -90,
        color: isDeadlock ? '#f59e0b' : isPrevented ? '#10b981' : '#0ea5e9',
        isCycle: isDeadlock
      },
      {
        id: 'RB',
        type: 'resource',
        label: 'Resource R_B',
        sub: 'Lock fd:201 (/tmp)',
        x: 0,
        y: -30,
        z: 90,
        color: isDeadlock ? '#f59e0b' : isPrevented ? '#10b981' : '#0ea5e9',
        isCycle: isDeadlock
      }
    ]
  }, [mode, p1State, p2State])

  // Directed edges (Allocated: Res -> Proc, Requested: Proc -> Res)
  const getEdges = useCallback(() => {
    if (mode === 'deadlock') {
      return [
        { from: 'RA', to: 'P1', kind: 'hold', label: 'Allocated (flock)' },
        { from: 'P1', to: 'RB', kind: 'wait', label: 'Waiting (Blocked)' },
        { from: 'RB', to: 'P2', kind: 'hold', label: 'Allocated (flock)' },
        { from: 'P2', to: 'RA', kind: 'wait', label: 'Waiting (Blocked)' }
      ]
    }
    if (mode === 'prevented') {
      return [
        { from: 'RA', to: 'P1', kind: 'hold', label: 'Rank 1 Acquired' },
        { from: 'RB', to: 'P1', kind: 'hold', label: 'Rank 2 Acquired' }
      ]
    }
    if (mode === 'resolved') {
      return [
        { from: 'RA', to: 'P1', kind: 'hold', label: 'Acquired' },
        { from: 'RB', to: 'P1', kind: 'hold', label: 'Acquired (Preempted from P2)' }
      ]
    }
    return [
      { from: 'P1', to: 'RA', kind: 'idle', label: 'Available' },
      { from: 'P2', to: 'RB', kind: 'idle', label: 'Available' }
    ]
  }, [mode])

  // Mouse interaction handlers for 3D Orbit
  const handleMouseDown = e => {
    cameraRef.current.isDragging = true
    cameraRef.current.lastX = e.clientX
    cameraRef.current.lastY = e.clientY
  }

  const handleMouseMove = e => {
    if (!cameraRef.current.isDragging) return
    const dx = e.clientX - cameraRef.current.lastX
    const dy = e.clientY - cameraRef.current.lastY
    cameraRef.current.lastX = e.clientX
    cameraRef.current.lastY = e.clientY

    cameraRef.current.theta += dx * 0.008
    cameraRef.current.phi = Math.max(-0.2, Math.min(1.4, cameraRef.current.phi - dy * 0.008))

    setCameraDisplay({
      theta: Math.round(((cameraRef.current.theta * 180) / Math.PI) % 360),
      phi: Math.round((cameraRef.current.phi * 180) / Math.PI)
    })
  }

  const handleMouseUp = () => {
    cameraRef.current.isDragging = false
  }

  const handleWheel = e => {
    e.preventDefault()
    cameraRef.current.dist = Math.max(200, Math.min(650, cameraRef.current.dist + e.deltaY * 0.4))
  }

  const resetView = () => {
    cameraRef.current.theta = 0.75
    cameraRef.current.phi = 0.45
    cameraRef.current.dist = 380
    setCameraDisplay({ theta: 43, phi: 26 })
  }

  // Main 3D Canvas Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let frame = 0

    const render = () => {
      frame++
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }

      ctx.clearRect(0, 0, width, height)

      // Perspective Projection Setup
      const cx = width / 2
      const cy = height / 2 + 15
      const fov = 340
      const cam = cameraRef.current

      // Camera Trigonometry
      const cosT = Math.cos(cam.theta)
      const sinT = Math.sin(cam.theta)
      const cosP = Math.cos(cam.phi)
      const sinP = Math.sin(cam.phi)

      // 3D Transform Function (World -> Camera View -> 2D Screen)
      const project3D = (x, y, z) => {
        // Rotate around Y-axis (theta)
        const x1 = x * cosT - z * sinT
        const z1 = x * sinT + z * cosT

        // Rotate around X-axis (phi)
        const y2 = y * cosP - z1 * sinP
        const z2 = y * sinP + z1 * cosP + cam.dist

        if (z2 <= 20) return null // Behind camera

        const scale = fov / z2
        const screenX = cx + x1 * scale
        const screenY = cy - y2 * scale

        return { x: screenX, y: screenY, z: z2, scale }
      }

      // 1. Draw 3D Isometric Grid Floor
      ctx.lineWidth = 1
      const gridSize = 160
      const gridStep = 40
      for (let gx = -gridSize; gx <= gridSize; gx += gridStep) {
        const pA = project3D(gx, -70, -gridSize)
        const pB = project3D(gx, -70, gridSize)
        if (pA && pB) {
          ctx.beginPath()
          ctx.moveTo(pA.x, pA.y)
          ctx.lineTo(pB.x, pB.y)
          ctx.strokeStyle = gx === 0 ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.03)'
          ctx.stroke()
        }
      }
      for (let gz = -gridSize; gz <= gridSize; gz += gridStep) {
        const pA = project3D(-gridSize, -70, gz)
        const pB = project3D(gridSize, -70, gz)
        if (pA && pB) {
          ctx.beginPath()
          ctx.moveTo(pA.x, pA.y)
          ctx.lineTo(pB.x, pB.y)
          ctx.strokeStyle = gz === 0 ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.03)'
          ctx.stroke()
        }
      }

      // Collect Projected Nodes
      const nodes = getNodes()
      const edges = getEdges()
      const nodeMap = {}

      const projectedNodes = nodes.map(n => {
        const proj = project3D(n.x, n.y, n.z)
        const item = { ...n, proj }
        nodeMap[n.id] = item
        return item
      })

      // 2. Draw 3D Directed Edges
      edges.forEach((edge, eIdx) => {
        const source = nodeMap[edge.from]
        const target = nodeMap[edge.to]
        if (!source?.proj || !target?.proj) return

        const pA = source.proj
        const pB = target.proj

        const isCycleEdge = mode === 'deadlock'
        const isHold = edge.kind === 'hold'
        const isWait = edge.kind === 'wait'

        // Color & Pulse
        let strokeColor = 'rgba(255, 255, 255, 0.15)'
        if (isWait) strokeColor = isCycleEdge ? '#f43f5e' : '#f59e0b'
        else if (isHold) strokeColor = '#10b981'

        // Base Arc Line
        ctx.beginPath()
        ctx.moveTo(pA.x, pA.y)

        // Arc curve control point in 3D mid-height
        const midX = (pA.x + pB.x) / 2
        const midY = (pA.y + pB.y) / 2 - (isWait ? 20 : -10)
        ctx.quadraticCurveTo(midX, midY, pB.x, pB.y)

        ctx.strokeStyle = strokeColor
        ctx.lineWidth = isCycleEdge && isWait ? 2.5 : 1.8
        if (isCycleEdge && isWait) {
          ctx.shadowColor = '#f43f5e'
          ctx.shadowBlur = 10
        } else {
          ctx.shadowBlur = 0
        }
        ctx.stroke()
        ctx.shadowBlur = 0

        // Animated particles along the vector beam
        const particleCount = isCycleEdge ? 4 : 2
        for (let i = 0; i < particleCount; i++) {
          const t = ((frame * 0.015 + (i / particleCount) + (eIdx * 0.25)) % 1)
          // Quadratic bezier point: B(t) = (1-t)^2 P0 + 2(1-t)t P1 + t^2 P2
          const inv = 1 - t
          const px = inv * inv * pA.x + 2 * inv * t * midX + t * t * pB.x
          const py = inv * inv * pA.y + 2 * inv * t * midY + t * t * pB.y

          ctx.beginPath()
          ctx.arc(px, py, isCycleEdge ? 3.5 : 2.5, 0, Math.PI * 2)
          ctx.fillStyle = isCycleEdge ? (isWait ? '#f43f5e' : '#10b981') : (isHold ? '#10b981' : '#f59e0b')
          ctx.fill()
        }

        // Draw directional arrowhead near target
        const arrowT = 0.88
        const invA = 1 - arrowT
        const arrowX = invA * invA * pA.x + 2 * invA * arrowT * midX + arrowT * arrowT * pB.x
        const arrowY = invA * invA * pA.y + 2 * invA * arrowT * midY + arrowT * arrowT * pB.y
        const angle = Math.atan2(pB.y - midY, pB.x - midX)

        ctx.beginPath()
        ctx.moveTo(arrowX, arrowY)
        ctx.lineTo(
          arrowX - 8 * Math.cos(angle - Math.PI / 6),
          arrowY - 8 * Math.sin(angle - Math.PI / 6)
        )
        ctx.lineTo(
          arrowX - 8 * Math.cos(angle + Math.PI / 6),
          arrowY - 8 * Math.sin(angle + Math.PI / 6)
        )
        ctx.closePath()
        ctx.fillStyle = strokeColor
        ctx.fill()
      })

      // 3. Draw 3D Nodes sorted by depth (Z-buffer)
      const sortedNodes = [...projectedNodes].filter(n => n.proj !== null).sort((a, b) => b.proj.z - a.proj.z)

      sortedNodes.forEach(n => {
        const { x, y, scale } = n.proj
        const isProcess = n.type === 'process'
        const radius = (isProcess ? 24 : 20) * scale

        // Drop shadow onto grid floor
        const floorProj = project3D(n.x, -70, n.z)
        if (floorProj) {
          ctx.beginPath()
          ctx.ellipse(floorProj.x, floorProj.y, radius * 0.9, radius * 0.45, 0, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'
          ctx.fill()

          // Ground connector stalk
          ctx.beginPath()
          ctx.moveTo(x, y + radius)
          ctx.lineTo(floorProj.x, floorProj.y)
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
          ctx.lineWidth = 1
          ctx.setLineDash([2, 4])
          ctx.stroke()
          ctx.setLineDash([])
        }

        // Cycle Halo Glow for Deadlocked Nodes
        if (n.isCycle) {
          const pulse = Math.sin(frame * 0.08) * 4
          ctx.beginPath()
          ctx.arc(x, y, radius + 8 + pulse, 0, Math.PI * 2)
          ctx.strokeStyle = 'rgba(244, 63, 94, 0.4)'
          ctx.lineWidth = 2
          ctx.stroke()
        }

        // Draw 3D Node Body
        ctx.beginPath()
        if (isProcess) {
          // Circular 3D Cylinder / Hexagon Process
          ctx.arc(x, y, radius, 0, Math.PI * 2)
        } else {
          // Geometric Diamond / Mutex Vault Resource
          ctx.moveTo(x, y - radius)
          ctx.lineTo(x + radius, y)
          ctx.lineTo(x, y + radius)
          ctx.lineTo(x - radius, y)
          ctx.closePath()
        }

        // Metallic Gradient Fill
        const grad = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, radius * 0.1, x, y, radius)
        grad.addColorStop(0, '#242428')
        grad.addColorStop(0.7, '#18181b')
        grad.addColorStop(1, '#0f0f11')
        ctx.fillStyle = grad
        ctx.fill()

        ctx.strokeStyle = n.color
        ctx.lineWidth = isProcess ? 2.5 : 2
        ctx.stroke()

        // Inner glowing core
        ctx.beginPath()
        ctx.arc(x, y, radius * 0.28, 0, Math.PI * 2)
        ctx.fillStyle = n.color
        ctx.shadowColor = n.color
        ctx.shadowBlur = 10
        ctx.fill()
        ctx.shadowBlur = 0

        // Typography Labels
        ctx.font = `600 ${Math.max(10, Math.round(11 * scale))}px "JetBrains Mono", monospace`
        ctx.fillStyle = '#f4f4f5'
        ctx.textAlign = 'center'
        ctx.fillText(n.label, x, y - radius - 8)

        ctx.font = `400 ${Math.max(8, Math.round(9 * scale))}px "JetBrains Mono", monospace`
        ctx.fillStyle = n.color
        ctx.fillText(n.sub, x, y + radius + 14)
      })

      // 4. Deadlock Loop Alert Banner (HUD)
      if (mode === 'deadlock') {
        ctx.save()
        ctx.fillStyle = 'rgba(244, 63, 94, 0.12)'
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.35)'
        ctx.lineWidth = 1
        ctx.roundRect(width / 2 - 170, 16, 340, 32, 6)
        ctx.fill()
        ctx.stroke()

        ctx.font = '600 11px "JetBrains Mono", monospace'
        ctx.fillStyle = '#f43f5e'
        ctx.textAlign = 'center'
        ctx.fillText('⚠ CIRCULAR WAIT DETECTED: P1 ⇄ P2 DEADLOCK', width / 2, 36)
        ctx.restore()
      } else if (mode === 'prevented') {
        ctx.save()
        ctx.fillStyle = 'rgba(16, 185, 129, 0.1)'
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.35)'
        ctx.lineWidth = 1
        ctx.roundRect(width / 2 - 180, 16, 360, 32, 6)
        ctx.fill()
        ctx.stroke()

        ctx.font = '600 11px "JetBrains Mono", monospace'
        ctx.fillStyle = '#10b981'
        ctx.textAlign = 'center'
        ctx.fillText('✓ PREVENTED: HIERARCHY ORDER F(A)=1 < F(B)=2', width / 2, 36)
        ctx.restore()
      }

      animRef.current = requestAnimationFrame(render)
    }

    render()

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [getNodes, getEdges, mode])

  return (
    <div
      className={`relative rounded-md border border-[var(--border)] bg-[#0d0d0f] overflow-hidden select-none ${className}`}
      style={{ height }}
    >
      {/* 3D Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-grab active:cursor-grabbing block"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />

      {/* Floating Controls HUD */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-[var(--surface)]/80 backdrop-blur-md px-2.5 py-1.5 rounded border border-[var(--border)] text-xs text-[var(--muted)]">
        <Rotate3d className="w-3.5 h-3.5 text-[var(--accent)]" />
        <span className="font-mono text-[11px] tabular-nums">
          θ:{cameraDisplay.theta}° φ:{cameraDisplay.phi}°
        </span>
        <button
          onClick={resetView}
          title="Reset Camera Angle"
          className="ml-1 p-1 hover:text-[var(--fg)] hover:bg-[var(--surface-hover)] rounded transition-colors"
        >
          <Maximize2 className="w-3 h-3" />
        </button>
      </div>

      {/* Bottom Hint & Legend */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] text-[var(--muted)] bg-[var(--surface)]/70 backdrop-blur-sm px-3 py-1.5 rounded border border-[var(--border)]">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6] border border-[#60a5fa]" /> Process (Circle)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rotate-45 bg-[#0ea5e9] border border-[#38bdf8]" /> Resource (Vault)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-[#10b981]" /> Holding Edge
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-[#f43f5e]" /> Request Edge (Wait)
          </span>
        </div>
        <div className="font-mono text-[10px] hidden sm:block">
          Drag to 3D Rotate · Scroll to Zoom
        </div>
      </div>
    </div>
  )
}
