import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ShieldAlert,
  Play,
  ShieldCheck,
  Zap,
  RotateCcw,
  Terminal,
  Calculator,
  BookOpen,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  Cpu,
  RefreshCw,
  Copy,
  Check,
  GitBranch,
  Activity,
  Plus,
  Trash2,
  Sliders,
  Sparkles,
  ArrowRight,
  Monitor,
} from 'lucide-react'
import { api } from '../api'
import { useScan } from '../hooks/useScan'
import { Badge, Btn } from '../components/ui'
import Deadlock3D from '../components/Deadlock3D'

const BASH_CODE_SNIPPETS = {
  create: `#!/usr/bin/env bash
# Real OS Deadlock using POSIX flock causing circular wait
LOCK_DIR="/tmp/guardian_deadlock"
RES_A="$LOCK_DIR/resource_A.lock"
RES_B="$LOCK_DIR/resource_B.lock"

# Process 1: Locks A, waits, then tries to lock B (BLOCKED)
(
    exec 200>"$RES_A"
    flock -x 200
    echo "P1: Acquired Lock A (fd:200) - Holding and waiting..."
    sleep 1.2
    exec 201>"$RES_B"
    flock -x 201 # <--- KERNEL DEADLOCK: P2 holds Lock B!
) &

# Process 2: Locks B, waits, then tries to lock A (BLOCKED)
(
    exec 201>"$RES_B"
    flock -x 201
    echo "P2: Acquired Lock B (fd:201) - Holding and waiting..."
    sleep 1.2
    exec 200>"$RES_A"
    flock -x 200 # <--- KERNEL DEADLOCK: P1 holds Lock A!
) &`,

  prevent: `#!/usr/bin/env bash
# Deadlock Prevention via Dijkstra / Havender Total Resource Hierarchy Order
# RULE: Assign strict order F(Resource_A) = 1 < F(Resource_B) = 2
# Processes MUST acquire locks in strictly ascending numerical order.

# Process 1: Acquires A (Rank 1), then B (Rank 2)
(
    exec 200>"$RES_A" && flock -x 200
    exec 201>"$RES_B" && flock -x 201
    echo "P1: Acquired both locks in order. Critical task executing..."
    flock -u 201 && flock -u 200
) &

# Process 2: ALSO acquires A (Rank 1) first (BREAKS CIRCULAR WAIT!)
(
    sleep 0.2
    # P2 cannot lock B first; it waits for A without holding any resource.
    exec 200>"$RES_A" && flock -x 200
    exec 201>"$RES_B" && flock -x 201
    echo "P2: Acquired both locks in order safely."
    flock -u 201 && flock -u 200
) &`,

  resolve: `#!/usr/bin/env bash
# Deadlock Detection & Resolution: Minimum-Cost Victim Preemption
P1_PID=$(cat /tmp/guardian_deadlock/pids.txt | head -n1)
P2_PID=$(cat /tmp/guardian_deadlock/pids.txt | tail -n1)

# Algorithm selects victim P2 to minimize rollback overhead
echo "Selecting victim Process P2 ($P2_PID)..."
kill -15 "$P2_PID" 2>/dev/null || kill -9 "$P2_PID"

# Releasing Lock B allows survivor P1 to acquire B, complete, and exit
echo "Resource B preempted. Process P1 unblocked and completes critical section."`,
}

const SAFE_BANKER_PRESET = {
  available: [3, 3, 2],
  maximum: [
    [7, 5, 3],
    [3, 2, 2],
    [9, 0, 2],
    [2, 2, 2],
    [4, 3, 3],
  ],
  allocation: [
    [0, 1, 0],
    [2, 0, 0],
    [3, 0, 2],
    [2, 1, 1],
    [0, 0, 2],
  ],
}

const UNSAFE_BANKER_PRESET = {
  available: [0, 0, 1],
  maximum: [
    [7, 5, 3],
    [3, 2, 2],
    [9, 0, 2],
    [2, 2, 2],
    [4, 3, 3],
  ],
  allocation: [
    [0, 1, 0],
    [2, 0, 0],
    [3, 0, 2],
    [2, 1, 1],
    [0, 0, 2],
  ],
}

const REAL_PC_RESOURCE_TEMPLATES = [
  { name: 'SQLite DB Lock', sub: 'guardian.db · WAL' },
  { name: 'Port 8000 Socket', sub: 'TCP :8000 · FastAPI' },
  { name: 'GPU VRAM Mutex', sub: 'CUDA/DX12 Handle' },
  { name: 'Config File Lock', sub: 'watchlist.conf · flock' },
]

// Local DFS fallback for instant cycle detection in Custom Sandbox
function localDetectCycle(graph) {
  const visited = new Set()
  const stack = []
  const dfs = node => {
    visited.add(node)
    stack.push(node)
    for (const next of graph[node] || []) {
      if (!visited.has(next)) {
        const res = dfs(next)
        if (res) return res
      } else if (stack.includes(next)) {
        return [...stack.slice(stack.indexOf(next)), next]
      }
    }
    stack.pop()
    return null
  }
  for (const k of Object.keys(graph)) {
    if (!visited.has(k)) {
      const res = dfs(k)
      if (res) return res
    }
  }
  return null
}

const glassCardStyle = {
  background: 'rgba(20, 22, 30, 0.64)',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
  border: '1px solid rgba(255, 255, 255, 0.11)',
  borderRadius: 14,
  padding: '16px 20px',
  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 12px 32px rgba(0, 0, 0, 0.38)',
}

export default function Deadlock({ src }) {
  // Lab Mode: 'kernel' (real POSIX flock) | 'custom' (Live PC & Custom Rule-Breaker Sandbox)
  const [labMode, setLabMode] = useState('kernel')
  const [activeMode, setActiveMode] = useState('idle') // 'idle' | 'deadlock' | 'prevented' | 'resolved'
  const [statusData, setStatusData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('simulator') // 'simulator' | 'code' | 'theory'
  const [codeType, setCodeType] = useState('create')
  const [copied, setCopied] = useState(false)

  // Live PC Processes for Custom Sandbox
  const { data: procScan, loading: procLoading, run: refreshProcs } = useScan('process', src || 'windows', true)
  const liveProcesses = useMemo(() => {
    const rows = procScan?.rows || []
    return [...rows]
      .sort((a, b) => (Number(b.cpu) || 0) - (Number(a.cpu) || 0))
      .slice(0, 12)
  }, [procScan])

  // Custom Sandbox State (Processes, Resources, Edges, Detected Cycle)
  const [customNodes, setCustomNodes] = useState([
    { id: 'P1', short: 'P1', type: 'process', label: 'Process P1', sub: 'User Task #1' },
    { id: 'P2', short: 'P2', type: 'process', label: 'Process P2', sub: 'User Task #2' },
    { id: 'R1', short: 'R_1', type: 'resource', label: 'SQLite DB Lock', sub: 'Rank #1 · Exclusive', rank: 1 },
    { id: 'R2', short: 'R_2', type: 'resource', label: 'Port 8000 Socket', sub: 'Rank #2 · Exclusive', rank: 2 },
  ])
  const [customEdges, setCustomEdges] = useState([
    { from: 'R1', to: 'P1', kind: 'hold', label: 'HOLDS' },
    { from: 'R2', to: 'P2', kind: 'hold', label: 'HOLDS' },
  ])
  const [customCycle, setCustomCycle] = useState(null)
  const [customState, setCustomState] = useState('idle') // 'idle' | 'deadlock' | 'prevented' | 'resolved'

  // Custom Add/Edge Form Inputs
  const [newProcName, setNewProcName] = useState('')
  const [newResName, setNewResName] = useState('')
  const [edgeFrom, setEdgeFrom] = useState('P1')
  const [edgeKind, setEdgeKind] = useState('wait') // 'wait' | 'hold'
  const [edgeTo, setEdgeTo] = useState('R2')

  // Banker's Algorithm State
  const [bankerInput, setBankerInput] = useState(SAFE_BANKER_PRESET)
  const [bankerResult, setBankerResult] = useState(null)
  const [bankerLoading, setBankerLoading] = useState(false)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.post(`/api/deadlock/action/status?source=${src || 'linux'}`)
      if (res && res.mode) {
        setStatusData(res)
        setActiveMode(res.mode)
      }
    } catch {
      // Ignored in offline/test mode
    }
  }, [src])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  // Evaluate Custom Graph via Backend /api/deadlock/wfg (with local DFS fallback)
  const evaluateCustomGraph = useCallback(async edgesList => {
    const graph = {}
    edgesList.forEach(e => {
      if (!graph[e.from]) graph[e.from] = []
      if (!graph[e.from].includes(e.to)) graph[e.from].push(e.to)
    })

    let foundCycle = localDetectCycle(graph)
    try {
      const res = await api.post('/api/deadlock/wfg', { graph })
      if (res && typeof res.has_cycle === 'boolean') {
        foundCycle = res.has_cycle ? res.cycle : null
      }
    } catch {
      // Fallback already computed
    }

    setCustomCycle(foundCycle)
    if (foundCycle && foundCycle.length > 0) {
      setCustomState('deadlock')
    } else if (edgesList.some(e => e.kind === 'order')) {
      setCustomState('prevented')
    } else {
      setCustomState('idle')
    }
  }, [])

  useEffect(() => {
    if (labMode === 'custom') {
      evaluateCustomGraph(customEdges)
    }
  }, [labMode, customEdges, evaluateCustomGraph])

  const runAction = async action => {
    setLoading(true)
    try {
      const res = await api.post(`/api/deadlock/action/${action}?source=${src || 'linux'}`)
      if (res) {
        setStatusData(res)
        if (action === 'create') setActiveMode('deadlock')
        else if (action === 'prevent') setActiveMode('prevented')
        else if (action === 'resolve') setActiveMode('resolved')
        else if (action === 'cleanup') {
          setActiveMode('idle')
          setStatusData(null)
        }
      }
    } catch (err) {
      console.error('Deadlock action failed:', err)
    } finally {
      setLoading(false)
    }
  }

  // Custom Sandbox Handlers
  const addCustomProcess = (labelOverride, subOverride) => {
    const name = (labelOverride || newProcName).trim()
    if (!name) return
    const nextIdx = customNodes.filter(n => n.type === 'process').length + 1
    const id = `P_${Date.now().toString().slice(-4)}_${nextIdx}`
    const short = name.replace(/\.exe$/i, '').slice(0, 7)
    setCustomNodes(prev => [
      ...prev,
      { id, short, type: 'process', label: name, sub: subOverride || 'Custom Process' },
    ])
    if (!labelOverride) setNewProcName('')
  }

  const addCustomResource = (labelOverride, subOverride) => {
    const name = (labelOverride || newResName).trim()
    if (!name) return
    const nextRank = customNodes.filter(n => n.type === 'resource').length + 1
    const id = `R_${Date.now().toString().slice(-4)}_${nextRank}`
    setCustomNodes(prev => [
      ...prev,
      { id, short: `R_${nextRank}`, type: 'resource', label: name, sub: subOverride || `Rank #${nextRank} · Lock`, rank: nextRank },
    ])
    if (!labelOverride) setNewResName('')
  }

  const removeCustomNode = nodeId => {
    setCustomNodes(prev => prev.filter(n => n.id !== nodeId))
    setCustomEdges(prev => prev.filter(e => e.from !== nodeId && e.to !== nodeId))
  }

  const addCustomEdge = () => {
    if (!edgeFrom || !edgeTo || edgeFrom === edgeTo) return
    const fromNode = customNodes.find(n => n.id === edgeFrom)
    const toNode = customNodes.find(n => n.id === edgeTo)
    if (!fromNode || !toNode) return

    // Enforce bipartite RAG direction: Hold = Resource -> Process, Wait = Process -> Resource
    const actualFrom = edgeKind === 'hold' && fromNode.type === 'process' && toNode.type === 'resource' ? edgeTo : edgeFrom
    const actualTo = edgeKind === 'hold' && fromNode.type === 'process' && toNode.type === 'resource' ? edgeFrom : edgeTo

    setCustomEdges(prev => {
      if (prev.some(e => e.from === actualFrom && e.to === actualTo && e.kind === edgeKind)) return prev
      return [
        ...prev,
        {
          from: actualFrom,
          to: actualTo,
          kind: edgeKind,
          label: edgeKind === 'hold' ? 'HOLDS' : 'WAITS (BREAK)',
        },
      ]
    })
  }

  const removeCustomEdge = idx => {
    setCustomEdges(prev => prev.filter((_, i) => i !== idx))
  }

  const triggerCustomRuleBreak = () => {
    const procs = customNodes.filter(n => n.type === 'process')
    const ress = customNodes.filter(n => n.type === 'resource')
    if (procs.length < 2 || ress.length < 2) return
    const p1 = procs[0].id
    const p2 = procs[1].id
    const r1 = ress[0].id
    const r2 = ress[1].id
    setCustomEdges([
      { from: r1, to: p1, kind: 'hold', label: `HOLDS ${ress[0].short}` },
      { from: p1, to: r2, kind: 'wait', label: `WAITS ${ress[1].short}` },
      { from: r2, to: p2, kind: 'hold', label: `HOLDS ${ress[1].short}` },
      { from: p2, to: r1, kind: 'wait', label: `WAITS ${ress[0].short}` },
    ])
  }

  const applyCustomPrevention = () => {
    const procs = customNodes.filter(n => n.type === 'process')
    const ress = customNodes.filter(n => n.type === 'resource')
    if (procs.length === 0 || ress.length === 0) return
    const ordered = []
    ress.forEach((r, idx) => {
      ordered.push({
        from: r.id,
        to: procs[0].id,
        kind: idx === 0 ? 'hold' : 'order',
        label: `Rank #${idx + 1} Safe`,
      })
    })
    setCustomEdges(ordered)
  }

  const preemptCustomVictim = () => {
    if (!customCycle || customCycle.length === 0) return
    const victimProc = customNodes.find(n => n.type === 'process' && customCycle.includes(n.id))
    if (!victimProc) return
    setCustomEdges(prev => prev.filter(e => e.from !== victimProc.id && e.to !== victimProc.id))
    setCustomState('resolved')
  }

  const solveBanker = async () => {
    setBankerLoading(true)
    try {
      const res = await api.post('/api/deadlock/banker', bankerInput)
      setBankerResult(res)
    } catch (err) {
      console.error('Bankers calculation failed:', err)
    } finally {
      setBankerLoading(false)
    }
  }

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(BASH_CODE_SNIPPETS[codeType])
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // Ignore clipboard error
    }
  }

  const effectiveMode = labMode === 'custom' ? customState : activeMode
  const isDeadlock = effectiveMode === 'deadlock'
  const isPrevented = effectiveMode === 'prevented'
  const isResolved = effectiveMode === 'resolved'

  const statusBadge = isDeadlock
    ? { v: 'DEADLOCK ACTIVE', tone: 'r' }
    : isPrevented
    ? { v: 'PREVENTION VERIFIED', tone: 'g' }
    : isResolved
    ? { v: 'RECOVERED', tone: 'a' }
    : { v: 'SYSTEM IDLE', tone: 'c' }

  const accentBorderColor = isDeadlock
    ? 'var(--r)'
    : isPrevented
    ? 'var(--g)'
    : isResolved
    ? 'var(--a)'
    : 'var(--c)'

  const needMatrix = bankerInput.maximum.map((row, i) =>
    row.map((val, j) => Math.max(0, val - (bankerInput.allocation[i]?.[j] || 0)))
  )

  const customProcs = customNodes.filter(n => n.type === 'process')
  const customRess = customNodes.filter(n => n.type === 'resource')

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Ambient Glassmorphic Gradient Orbs */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 70,
          right: 40,
          width: 340,
          height: 340,
          borderRadius: '50%',
          background: isDeadlock
            ? 'radial-gradient(circle, rgba(244,63,94,0.16) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(16,185,129,0.14) 0%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 0,
          filter: 'blur(30px)',
        }}
      />

      {/* ── Top Glassmorphic Hero Header ── */}
      <div
        style={{
          ...glassCardStyle,
          position: 'relative',
          zIndex: 1,
          borderLeft: `4px solid ${accentBorderColor}`,
          background: 'linear-gradient(135deg, rgba(22, 25, 36, 0.78) 0%, rgba(16, 185, 129, 0.06) 100%)',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'rgba(56, 189, 248, 0.16)',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#38bdf8',
                  boxShadow: '0 0 16px rgba(56, 189, 248, 0.2)',
                }}
              >
                <GitBranch size={18} />
              </div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--fg)', letterSpacing: '-0.02em' }}>
                Deadlock Engineering Lab
              </h1>
              <Badge v={statusBadge.v} tone={statusBadge.tone} />
            </div>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
              Real OS POSIX lock simulation, Live PC Custom Rule-Breaker Sandbox, Dijkstra&apos;s Ordering, and Banker&apos;s Algorithm.
            </p>
          </div>

          {/* Mode Toggle + Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
            <div
              style={{
                display: 'inline-flex',
                padding: 4,
                borderRadius: 10,
                background: 'rgba(10, 12, 18, 0.65)',
                border: '1px solid rgba(255,255,255,0.1)',
                gap: 4,
              }}
            >
              <button
                onClick={() => setLabMode('kernel')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 12px',
                  borderRadius: 7,
                  border: 'none',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: labMode === 'kernel' ? 'rgba(16, 185, 129, 0.22)' : 'transparent',
                  color: labMode === 'kernel' ? '#34d399' : 'var(--dim)',
                }}
              >
                <Terminal size={13} /> OS Kernel (POSIX flock)
              </button>
              <button
                onClick={() => setLabMode('custom')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 12px',
                  borderRadius: 7,
                  border: 'none',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: labMode === 'custom' ? 'rgba(167, 139, 250, 0.24)' : 'transparent',
                  color: labMode === 'custom' ? '#c4b5fd' : 'var(--dim)',
                }}
              >
                <Sliders size={13} /> Custom &amp; Live PC Sandbox
              </button>
            </div>

            {labMode === 'kernel' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Btn
                  onClick={() => runAction('create')}
                  disabled={loading || isDeadlock}
                  style={{
                    background: 'rgba(244, 63, 94, 0.16)',
                    color: '#fb7185',
                    border: '1px solid rgba(244, 63, 94, 0.45)',
                    fontWeight: 600,
                  }}
                >
                  <Play size={14} /> Trigger OS Deadlock (flock)
                </Btn>
                <Btn
                  onClick={() => runAction('prevent')}
                  disabled={loading}
                  style={{
                    background: 'rgba(16, 185, 129, 0.16)',
                    color: '#34d399',
                    border: '1px solid rgba(16, 185, 129, 0.45)',
                    fontWeight: 600,
                  }}
                >
                  <ShieldCheck size={14} /> Run Prevention (Ordering)
                </Btn>
                <Btn
                  onClick={() => runAction('resolve')}
                  disabled={loading || !isDeadlock}
                  style={{
                    background: 'rgba(245, 158, 11, 0.16)',
                    color: '#fbbf24',
                    border: '1px solid rgba(245, 158, 11, 0.45)',
                    fontWeight: 600,
                  }}
                >
                  <Zap size={14} /> Break Deadlock (Preempt Victim)
                </Btn>
                <Btn onClick={() => runAction('cleanup')} disabled={loading} title="Reset Lab Environment">
                  <RotateCcw size={14} /> Reset
                </Btn>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Btn
                  onClick={triggerCustomRuleBreak}
                  style={{
                    background: 'rgba(244, 63, 94, 0.16)',
                    color: '#fb7185',
                    border: '1px solid rgba(244, 63, 94, 0.45)',
                    fontWeight: 600,
                  }}
                >
                  <AlertTriangle size={14} /> Break Rule (Create Cycle)
                </Btn>
                <Btn
                  onClick={applyCustomPrevention}
                  style={{
                    background: 'rgba(16, 185, 129, 0.16)',
                    color: '#34d399',
                    border: '1px solid rgba(16, 185, 129, 0.45)',
                    fontWeight: 600,
                  }}
                >
                  <ShieldCheck size={14} /> Apply Dijkstra Ordering
                </Btn>
                <Btn
                  onClick={preemptCustomVictim}
                  disabled={!isDeadlock}
                  style={{
                    background: 'rgba(245, 158, 11, 0.16)',
                    color: '#fbbf24',
                    border: '1px solid rgba(245, 158, 11, 0.45)',
                    fontWeight: 600,
                  }}
                >
                  <Zap size={14} /> Preempt Victim
                </Btn>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Custom & Real-PC Deadlock Builder Panel (shown in Custom Sandbox mode) ── */}
      {labMode === 'custom' && (
        <div
          style={{
            ...glassCardStyle,
            position: 'relative',
            zIndex: 1,
            borderColor: 'rgba(167, 139, 250, 0.32)',
            background: 'linear-gradient(135deg, rgba(24, 24, 38, 0.72) 0%, rgba(56, 189, 248, 0.05) 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Monitor size={16} color="#c4b5fd" />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg)' }}>
                Custom &amp; Live PC Process / Resource Builder
              </span>
              <Badge v="REAL PC DATA" tone="p" />
            </div>
            <Btn variant="secondary" onClick={refreshProcs} loading={procLoading}>
              <RefreshCw size={12} /> Refresh Live PC Processes
            </Btn>
          </div>

          {/* 3-Column Glass Builder Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
            {/* 1. Live PC Processes Picker + Custom Add */}
            <div style={{ padding: 12, borderRadius: 10, background: 'rgba(10, 12, 18, 0.55)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', marginBottom: 8 }}>
                1. ADD PROCESS (LIVE PC OR CUSTOM)
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <input
                  className="in"
                  style={{ flex: 1, marginRight: 0 }}
                  placeholder="e.g. chrome.exe or P3"
                  value={newProcName}
                  onChange={e => setNewProcName(e.target.value)}
                />
                <Btn onClick={() => addCustomProcess()}>
                  <Plus size={13} /> Add
                </Btn>
              </div>
              <div style={{ fontSize: 10, color: 'var(--dim)', marginBottom: 6 }}>
                Click any live PC process to import into graph:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, maxHeight: 84, overflowY: 'auto' }}>
                {liveProcesses.length === 0 ? (
                  <span style={{ fontSize: 11, color: 'var(--dim)' }}>No live scan rows yet</span>
                ) : (
                  liveProcesses.map((p, idx) => (
                    <button
                      key={`${p.pid}-${idx}`}
                      onClick={() => addCustomProcess(p.name, `PID ${p.pid} · CPU ${p.cpu ?? 0}%`)}
                      className="mono"
                      style={{
                        padding: '3px 7px',
                        borderRadius: 6,
                        fontSize: 10,
                        background: 'rgba(56, 189, 248, 0.12)',
                        border: '1px solid rgba(56, 189, 248, 0.28)',
                        color: '#7dd3fc',
                        cursor: 'pointer',
                      }}
                    >
                      + {p.name} ({p.pid})
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* 2. Resources Picker + Custom Add */}
            <div style={{ padding: 12, borderRadius: 10, background: 'rgba(10, 12, 18, 0.55)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', marginBottom: 8 }}>
                2. ADD RESOURCE LOCK (RANKED)
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <input
                  className="in"
                  style={{ flex: 1, marginRight: 0 }}
                  placeholder="e.g. File Mutex or R3"
                  value={newResName}
                  onChange={e => setNewResName(e.target.value)}
                />
                <Btn onClick={() => addCustomResource()}>
                  <Plus size={13} /> Add
                </Btn>
              </div>
              <div style={{ fontSize: 10, color: 'var(--dim)', marginBottom: 6 }}>
                Quick PC system locks:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {REAL_PC_RESOURCE_TEMPLATES.map(r => (
                  <button
                    key={r.name}
                    onClick={() => addCustomResource(r.name, r.sub)}
                    className="mono"
                    style={{
                      padding: '3px 7px',
                      borderRadius: 6,
                      fontSize: 10,
                      background: 'rgba(167, 139, 250, 0.12)',
                      border: '1px solid rgba(167, 139, 250, 0.28)',
                      color: '#ddd6fe',
                      cursor: 'pointer',
                    }}
                  >
                    + {r.name}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Add / Remove Edges (Create Rules or Break Rules) */}
            <div style={{ padding: 12, borderRadius: 10, background: 'rgba(10, 12, 18, 0.55)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', marginBottom: 8 }}>
                3. CONNECT HOLD / WAIT EDGES
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                <select
                  className="in"
                  style={{ flex: 1, marginRight: 0, minWidth: 85 }}
                  value={edgeFrom}
                  onChange={e => setEdgeFrom(e.target.value)}
                >
                  {customNodes.map(n => (
                    <option key={n.id} value={n.id}>{n.label}</option>
                  ))}
                </select>
                <select
                  className="in"
                  style={{ marginRight: 0 }}
                  value={edgeKind}
                  onChange={e => setEdgeKind(e.target.value)}
                >
                  <option value="wait">WAITS FOR (P → R)</option>
                  <option value="hold">HOLDS (R → P)</option>
                </select>
                <select
                  className="in"
                  style={{ flex: 1, marginRight: 0, minWidth: 85 }}
                  value={edgeTo}
                  onChange={e => setEdgeTo(e.target.value)}
                >
                  {customNodes.map(n => (
                    <option key={n.id} value={n.id}>{n.label}</option>
                  ))}
                </select>
                <Btn variant="primary" onClick={addCustomEdge}>
                  <Plus size={13} /> Link
                </Btn>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, maxHeight: 72, overflowY: 'auto' }}>
                {customEdges.map((e, idx) => {
                  const fn = customNodes.find(n => n.id === e.from)?.short || e.from
                  const tn = customNodes.find(n => n.id === e.to)?.short || e.to
                  return (
                    <span
                      key={idx}
                      className="mono"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '2px 7px',
                        borderRadius: 6,
                        fontSize: 10,
                        background: e.kind === 'wait' ? 'rgba(244,63,94,0.16)' : 'rgba(16,185,129,0.14)',
                        border: `1px solid ${e.kind === 'wait' ? 'rgba(244,63,94,0.4)' : 'rgba(16,185,129,0.35)'}`,
                        color: e.kind === 'wait' ? '#fda4af' : '#6ee7b7',
                      }}
                    >
                      {fn} → {tn}
                      <button
                        onClick={() => removeCustomEdge(idx)}
                        style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'flex' }}
                      >
                        <Trash2 size={10} />
                      </button>
                    </span>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Active Nodes Chips with Remove */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <span style={{ fontSize: 11, color: 'var(--dim)', alignSelf: 'center', marginRight: 4 }}>Active Graph Nodes:</span>
            {customNodes.map(n => (
              <span
                key={n.id}
                className="mono"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '3px 8px',
                  borderRadius: 999,
                  fontSize: 11,
                  background: n.type === 'process' ? 'rgba(56, 189, 248, 0.14)' : 'rgba(167, 139, 250, 0.14)',
                  border: `1px solid ${n.type === 'process' ? 'rgba(56, 189, 248, 0.35)' : 'rgba(167, 139, 250, 0.35)'}`,
                  color: 'var(--fg)',
                }}
              >
                {n.label}
                {customNodes.length > 2 && (
                  <button
                    onClick={() => removeCustomNode(n.id)}
                    title="Remove node"
                    style={{ background: 'none', border: 'none', color: '#fb7185', cursor: 'pointer', padding: 0, display: 'flex' }}
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Main 2-Column Stage: RAG Visualizer + Coffman Forensics ── */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: 18,
          alignItems: 'start',
        }}
      >
        {/* Left: Interactive 3D/2D Graph + Live Status Strip */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', fontSize: 12 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'var(--fg)' }}>
              <Cpu size={15} color="var(--accent)" />
              Interactive Resource Allocation Graph (RAG)
            </span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--dim)' }}>
              {labMode === 'custom' ? `${customProcs.length} Procs · ${customRess.length} Locks` : 'POSIX flock · /proc/locks'}
            </span>
          </div>

          <Deadlock3D
            mode={effectiveMode}
            p1State={statusData?.p1}
            p2State={statusData?.p2}
            cycle={labMode === 'custom' ? customCycle : statusData?.cycle}
            customNodes={labMode === 'custom' ? customNodes : null}
            customEdges={labMode === 'custom' ? customEdges : null}
            height={460}
          />

          {/* Live Telemetry & Sequence Rule Strip */}
          <div
            style={{
              ...glassCardStyle,
              padding: '12px 16px',
              borderLeft: `3px solid ${accentBorderColor}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Activity size={15} color={accentBorderColor} />
              <span className="mono" style={{ fontSize: 12, color: 'var(--fg)' }}>
                {isDeadlock
                  ? customCycle
                    ? `Cycle Confirmed: ${customCycle.join(' → ')}`
                    : 'Kernel Deadlock Established · P1 and P2 blocked waiting on mutual locks.'
                  : isPrevented
                  ? 'Resource Hierarchy Enforced · Ascending lock sequence eliminates circular wait.'
                  : isResolved
                  ? 'Victim Preempted · Locks released and survivor process completed.'
                  : 'Idle · No conflicting lock cycles detected.'}
              </span>
            </div>
            {labMode === 'kernel' && statusData?.p1?.pid && (
              <Badge v={`P1:${statusData.p1.pid} · P2:${statusData.p2?.pid || 'Terminated'}`} tone="p" />
            )}
          </div>
        </div>

        {/* Right: Coffman Conditions + Kernel Lock Registry */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={glassCardStyle}>
            <h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: 'var(--fg)', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 8 }}>
              Coffman Conditions Forensics
            </h4>
            <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--text-secondary)' }}>
              Deadlock mathematically requires all 4 conditions to hold simultaneously:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <CoffmanRow
                icon={<Lock size={15} color="#34d399" />}
                title="1. Mutual Exclusion"
                badge={<Badge v="ACTIVE" tone="r" />}
                accent="#34d399"
                desc="Locks are exclusive; only one process can hold a lock at a time."
              />
              <CoffmanRow
                icon={<AlertTriangle size={15} color={isDeadlock ? '#fb7185' : '#85858b'} />}
                title="2. Hold & Wait"
                badge={<Badge v={isDeadlock ? 'ACTIVE' : 'INACTIVE'} tone={isDeadlock ? 'r' : 'g'} />}
                accent={isDeadlock ? '#fb7185' : '#4cc38a'}
                desc={
                  isDeadlock
                    ? 'Processes hold at least one lock while waiting for another held lock.'
                    : 'Processes release or do not hold resources while waiting.'
                }
              />
              <CoffmanRow
                icon={<ShieldAlert size={15} color={isResolved ? '#34d399' : '#fbbf24'} />}
                title="3. No Preemption"
                badge={<Badge v={isResolved ? 'BROKEN (PREEMPTED)' : 'ACTIVE'} tone={isResolved ? 'g' : 'a'} />}
                accent={isResolved ? '#34d399' : '#f59e0b'}
                desc={
                  isResolved
                    ? 'Preemption forcibly terminated victim process to release held locks.'
                    : 'OS does not seize locks without explicit release or termination.'
                }
              />
              <CoffmanRow
                icon={
                  isPrevented ? (
                    <CheckCircle2 size={15} color="#34d399" />
                  ) : isDeadlock ? (
                    <XCircle size={15} color="#fb7185" />
                  ) : (
                    <Lock size={15} color="#38bdf8" />
                  )
                }
                title="4. Circular Wait"
                badge={
                  <Badge
                    v={isDeadlock ? 'LOOP DETECTED' : isPrevented ? 'BROKEN BY RULE' : 'CLEARED'}
                    tone={isDeadlock ? 'r' : 'g'}
                  />
                }
                accent={isDeadlock ? '#fb7185' : '#10b981'}
                desc={
                  isPrevented
                    ? 'Dijkstra hierarchy F(R_1)=1 < F(R_2)=2 breaks circular dependency.'
                    : isDeadlock
                    ? 'Closed wait cycle confirmed by DFS Wait-For Graph detector.'
                    : 'No circular wait cycles present.'
                }
              />
            </div>
          </div>

          <div style={glassCardStyle}>
            <h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: 'var(--fg)', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 8 }}>
              Dijkstra Resource Hierarchy Sequence
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              {(labMode === 'custom' ? customRess : [{ id: 'RA', label: 'R_A' }, { id: 'RB', label: 'R_B' }]).map((r, i, arr) => (
                <span key={r.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span
                    className="mono"
                    style={{
                      padding: '4px 9px',
                      borderRadius: 7,
                      fontSize: 11,
                      fontWeight: 600,
                      background: isDeadlock ? 'rgba(244,63,94,0.14)' : 'rgba(16,185,129,0.14)',
                      border: `1px solid ${isDeadlock ? 'rgba(244,63,94,0.38)' : 'rgba(16,185,129,0.38)'}`,
                      color: isDeadlock ? '#fda4af' : '#6ee7b7',
                    }}
                  >
                    #{i + 1} {r.label}
                  </span>
                  {i < arr.length - 1 && <ArrowRight size={13} color="var(--dim)" />}
                </span>
              ))}
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-secondary)' }}>
              {isDeadlock
                ? 'Rule Violated: A process requested a lower-rank lock while holding a higher-rank lock.'
                : 'Rule Satisfied: Locks must be acquired strictly from left (#1) to right.'}
            </div>
          </div>
        </div>
      </div>

      {/* ── Deep-Dive Glassmorphic Tabs: Banker's Sequence | Bash Code | Theory ── */}
      <div style={{ ...glassCardStyle, padding: 0, overflow: 'hidden', position: 'relative', zIndex: 1 }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            padding: '10px 16px 0',
            background: 'rgba(12, 14, 20, 0.72)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <TabBtn
            active={activeTab === 'simulator'}
            onClick={() => setActiveTab('simulator')}
            icon={<Calculator size={14} color="#34d399" />}
            label="Banker's Algorithm & Sequence Flow"
          />
          <TabBtn
            active={activeTab === 'code'}
            onClick={() => setActiveTab('code')}
            icon={<Terminal size={14} color="#38bdf8" />}
            label="Real Linux Bash Source Code"
          />
          <TabBtn
            active={activeTab === 'theory'}
            onClick={() => setActiveTab('theory')}
            icon={<BookOpen size={14} color="#a78bfa" />}
            label="Academic Operating Systems Guide"
          />
        </div>

        {/* Tab 1: Banker's Algorithm + Unique Step-by-Step Sequence Timeline */}
        {activeTab === 'simulator' && (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600, color: 'var(--fg)' }}>
                  Dijkstra&apos;s Banker&apos;s Safety Algorithm
                </h3>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
                  Test Safe vs Unsafe resource states and inspect the exact step-by-step execution sequence.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Btn
                  variant="secondary"
                  onClick={() => {
                    setBankerInput(SAFE_BANKER_PRESET)
                    setBankerResult(null)
                  }}
                >
                  Load Safe Preset
                </Btn>
                <Btn
                  variant="secondary"
                  onClick={() => {
                    setBankerInput(UNSAFE_BANKER_PRESET)
                    setBankerResult(null)
                  }}
                >
                  Load Unsafe Preset
                </Btn>
                <Btn variant="primary" onClick={solveBanker} disabled={bankerLoading}>
                  <RefreshCw size={14} className={bankerLoading ? 'spin' : ''} />
                  Compute Safe Sequence
                </Btn>
              </div>
            </div>

            {/* Matrix Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
              <div style={{ padding: 14, borderRadius: 10, background: 'rgba(10, 12, 18, 0.55)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#34d399', marginBottom: 10 }}>
                  AVAILABLE VECTOR [A, B, C] (EDITABLE)
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {bankerInput.available.map((v, idx) => (
                    <input
                      key={idx}
                      type="number"
                      min={0}
                      max={20}
                      value={v}
                      onChange={e => {
                        const val = Math.max(0, parseInt(e.target.value || '0', 10))
                        setBankerInput(prev => {
                          const next = [...prev.available]
                          next[idx] = val
                          return { ...prev, available: next }
                        })
                      }}
                      className="mono"
                      style={{
                        width: '100%',
                        textAlign: 'center',
                        padding: '8px 4px',
                        borderRadius: 7,
                        background: 'rgba(16, 185, 129, 0.14)',
                        border: '1px solid rgba(16, 185, 129, 0.35)',
                        color: '#34d399',
                        fontWeight: 700,
                        fontSize: 15,
                      }}
                    />
                  ))}
                </div>
              </div>

              <MatrixBox title="ALLOCATION MATRIX" color="#38bdf8" rows={bankerInput.allocation} />
              <MatrixBox title="MAX DEMAND MATRIX" color="#a78bfa" rows={bankerInput.maximum} />
              <MatrixBox title="NEED MATRIX (MAX - ALLOC)" color="#fbbf24" rows={needMatrix} />
            </div>

            {bankerResult && (
              <div
                style={{
                  padding: 18,
                  borderRadius: 12,
                  background: bankerResult.is_safe ? 'rgba(16, 185, 129, 0.10)' : 'rgba(244, 63, 94, 0.10)',
                  border: `1px solid ${bankerResult.is_safe ? 'rgba(16, 185, 129, 0.38)' : 'rgba(244, 63, 94, 0.38)'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {bankerResult.is_safe ? <CheckCircle2 size={18} color="#34d399" /> : <XCircle size={18} color="#fb7185" />}
                    <span style={{ fontWeight: 700, fontSize: 14, color: bankerResult.is_safe ? '#34d399' : '#fb7185' }}>
                      {bankerResult.is_safe ? 'SAFE STATE CONFIRMED' : 'UNSAFE STATE DETECTED (DEADLOCK RISK)'}
                    </span>
                  </div>
                  {bankerResult.is_safe && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Sparkles size={13} color="#34d399" />
                      {bankerResult.safe_sequence.map((proc, idx) => (
                        <span key={proc} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <Badge v={proc} tone="g" />
                          {idx < bankerResult.safe_sequence.length - 1 && <ArrowRight size={12} color="var(--dim)" />}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Unique Step-by-Step Execution Sequence Cards */}
                {Array.isArray(bankerResult.steps) && bankerResult.steps.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
                    {bankerResult.steps.map((st, idx) => (
                      <div
                        key={st.process}
                        style={{
                          padding: 12,
                          borderRadius: 10,
                          background: 'rgba(10, 12, 18, 0.65)',
                          border: '1px solid rgba(16, 185, 129, 0.28)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span className="mono" style={{ fontSize: 10, color: 'var(--dim)' }}>STEP #{idx + 1}</span>
                          <Badge v={st.process} tone="g" />
                        </div>
                        <div className="mono" style={{ fontSize: 11, color: '#fbbf24' }}>
                          Need: [{st.need.join(', ')}] ≤ Work
                        </div>
                        <div className="mono" style={{ fontSize: 11, color: '#7dd3fc' }}>
                          Work: [{st.work_before.join(',')}] → [{st.work_after.join(',')}]
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!bankerResult.is_safe && (
                  <div style={{ fontSize: 12, color: '#fda4af' }}>
                    No safe sequence exists. Starved / deadlocked processes: {bankerResult.deadlocked_processes.join(', ')}.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Bash Source Code */}
        {activeTab === 'code' && (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Genuine Linux Bash scripts executed on the host kernel:
              </span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <ScriptBtn active={codeType === 'create'} color="#fb7185" onClick={() => setCodeType('create')} label="deadlock_create.sh" />
                <ScriptBtn active={codeType === 'prevent'} color="#34d399" onClick={() => setCodeType('prevent')} label="deadlock_prevent.sh" />
                <ScriptBtn active={codeType === 'resolve'} color="#fbbf24" onClick={() => setCodeType('resolve')} label="deadlock_resolve.sh" />
                <Btn variant="secondary" onClick={copyCode}>
                  {copied ? <Check size={13} color="#34d399" /> : <Copy size={13} />}
                  {copied ? 'Copied' : 'Copy'}
                </Btn>
              </div>
            </div>

            <pre
              className="mono"
              style={{
                margin: 0,
                padding: 16,
                borderRadius: 10,
                background: 'rgba(9, 10, 15, 0.85)',
                border: '1px solid rgba(255,255,255,0.08)',
                fontSize: 12,
                lineHeight: 1.65,
                overflowX: 'auto',
                color: '#e2e8f0',
              }}
            >
              {BASH_CODE_SNIPPETS[codeType].split('\n').map((line, i) => {
                const isComment = line.trim().startsWith('#')
                return (
                  <div key={i} style={{ display: 'flex', gap: 14 }}>
                    <span style={{ color: '#475569', userSelect: 'none', minWidth: 22, textAlign: 'right' }}>{i + 1}</span>
                    <span style={{ color: isComment ? '#64748b' : line.includes('flock') ? '#34d399' : '#e2e8f0' }}>{line}</span>
                  </div>
                )
              })}
            </pre>
          </div>
        )}

        {/* Tab 3: Academic OS Guide */}
        {activeTab === 'theory' && (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#38bdf8' }}>
              Formal Operating Systems Deadlock Theory (Faculty Presentation)
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
              <TheoryCard
                title="1. Deadlock Prevention (Havender)"
                color="#34d399"
                body="Assigns a strict total order F(R_A) = 1 < F(R_B) = 2 to all locks. Because every process acquires locks in ascending order, Circular Wait is mathematically impossible."
              />
              <TheoryCard
                title="2. Deadlock Avoidance (Banker's)"
                color="#38bdf8"
                body="Dynamically checks each allocation request using Dijkstra's Banker's Algorithm. Requests are granted only if at least one Safe Sequence exists for all processes."
              />
              <TheoryCard
                title="3. Wait-For Graph Detection"
                color="#a78bfa"
                body="Builds a directed Wait-For Graph from kernel /proc/locks or custom PC dependencies and runs Depth-First Search (DFS) to detect cycles in real time."
              />
              <TheoryCard
                title="4. Recovery via Preemption"
                color="#fbbf24"
                body="Selects a minimum-cost victim process, terminates it cleanly (SIGTERM/SIGKILL), and releases its held locks so survivor processes complete immediately."
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function CoffmanRow({ icon, title, badge, accent, desc }) {
  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius: 9,
        background: 'rgba(10, 12, 18, 0.55)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderLeft: `3px solid ${accent}`,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
      }}
    >
      <div style={{ marginTop: 2, flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
          <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--fg)' }}>{title}</span>
          {badge}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{desc}</div>
      </div>
    </div>
  )
}

function TabBtn({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        padding: '8px 12px 10px',
        background: 'transparent',
        border: 'none',
        borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
        color: active ? 'var(--fg)' : 'var(--dim)',
        fontWeight: active ? 600 : 500,
        fontSize: 12,
        cursor: 'pointer',
      }}
    >
      {icon}
      {label}
    </button>
  )
}

function MatrixBox({ title, color, rows }) {
  return (
    <div style={{ padding: 14, borderRadius: 10, background: 'rgba(10, 12, 18, 0.55)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color, marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {rows.map((row, idx) => (
          <div
            key={idx}
            className="mono"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 12,
              padding: '3px 6px',
              borderRadius: 4,
              background: idx % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'transparent',
            }}
          >
            <span style={{ color: 'var(--dim)' }}>P{idx}</span>
            <span style={{ color: 'var(--fg)' }}>[{row.join(', ')}]</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ScriptBtn({ active, color, onClick, label }) {
  return (
    <button
      onClick={onClick}
      className="mono"
      style={{
        padding: '5px 10px',
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 600,
        cursor: 'pointer',
        background: active ? `${color}22` : 'transparent',
        color: active ? color : 'var(--dim)',
        border: `1px solid ${active ? `${color}66` : 'rgba(255,255,255,0.12)'}`,
      }}
    >
      {label}
    </button>
  )
}

function TheoryCard({ title, color, body }) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 10,
        background: 'rgba(10, 12, 18, 0.55)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderTop: `3px solid ${color}`,
      }}
    >
      <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color }}>{title}</h4>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{body}</p>
    </div>
  )
}
