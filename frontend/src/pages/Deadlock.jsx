import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
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
  Info,
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

const INITIAL_CUSTOM_NODES = [
  { id: 'P1', short: 'P1', type: 'process', label: 'Process P1', sub: 'User Task #1' },
  { id: 'P2', short: 'P2', type: 'process', label: 'Process P2', sub: 'User Task #2' },
  { id: 'R1', short: 'R_1', type: 'resource', label: 'SQLite DB Lock', sub: 'Rank #1 · Exclusive', rank: 1 },
  { id: 'R2', short: 'R_2', type: 'resource', label: 'Port 8000 Socket', sub: 'Rank #2 · Exclusive', rank: 2 },
]

const INITIAL_CUSTOM_EDGES = [
  { from: 'R1', to: 'P1', kind: 'hold', label: 'HOLDS R_1' },
  { from: 'R2', to: 'P2', kind: 'hold', label: 'HOLDS R_2' },
]

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
  background: 'rgba(20, 22, 30, 0.66)',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
  border: '1px solid rgba(255, 255, 255, 0.11)',
  borderRadius: 14,
  padding: '16px 20px',
  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 12px 32px rgba(0, 0, 0, 0.38)',
}

export default function Deadlock({ src }) {
  const [labMode, setLabMode] = useState('kernel') // 'kernel' | 'custom'
  const [activeMode, setActiveMode] = useState('idle') // 'idle' | 'deadlock' | 'prevented' | 'resolved'
  const [statusData, setStatusData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('simulator') // 'simulator' | 'code' | 'theory'
  const [codeType, setCodeType] = useState('create')
  const [copied, setCopied] = useState(false)
  const [actionNote, setActionNote] = useState(null) // { tone: 'info'|'warn'|'ok'|'err', text: string }

  // Live PC Processes for Custom Sandbox
  const { data: procScan, loading: procLoading, run: refreshProcs } = useScan('process', src || 'windows', true)
  const liveProcesses = useMemo(() => {
    const rows = procScan?.rows || []
    return [...rows]
      .sort((a, b) => (Number(b.cpu) || 0) - (Number(a.cpu) || 0))
      .slice(0, 12)
  }, [procScan])

  // Custom Sandbox State
  const [customNodes, setCustomNodes] = useState(INITIAL_CUSTOM_NODES)
  const [customEdges, setCustomEdges] = useState(INITIAL_CUSTOM_EDGES)
  const [customCycle, setCustomCycle] = useState(null)
  const [customState, setCustomState] = useState('idle')
  const skipNextEvalRef = useRef(false)

  // Clean bipartite selectors (Process <-> Resource)
  const customProcs = useMemo(() => customNodes.filter(n => n.type === 'process'), [customNodes])
  const customRess = useMemo(() => customNodes.filter(n => n.type === 'resource'), [customNodes])

  const [newProcName, setNewProcName] = useState('')
  const [newResName, setNewResName] = useState('')
  const [selectedProc, setSelectedProc] = useState('P1')
  const [edgeKind, setEdgeKind] = useState('wait') // 'wait' | 'hold'
  const [selectedRes, setSelectedRes] = useState('R2')

  // Keep dropdown selections valid when nodes are added/removed
  useEffect(() => {
    if (customProcs.length > 0 && !customProcs.some(p => p.id === selectedProc)) {
      setSelectedProc(customProcs[0].id)
    }
    if (customRess.length > 0 && !customRess.some(r => r.id === selectedRes)) {
      setSelectedRes(customRess[0].id)
    }
  }, [customProcs, customRess, selectedProc, selectedRes])

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

  // Evaluate Custom Graph via Backend /api/deadlock/wfg
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
    if (labMode !== 'custom') return
    if (skipNextEvalRef.current) {
      skipNextEvalRef.current = false
      return
    }
    evaluateCustomGraph(customEdges)
  }, [labMode, customEdges, evaluateCustomGraph])

  const runAction = async action => {
    setLoading(true)
    setActionNote(null)
    try {
      const res = await api.post(`/api/deadlock/action/${action}?source=${src || 'linux'}`)
      if (res?.error) {
        setActionNote({ tone: 'err', text: `OS Script Error: ${res.error}` })
        return
      }
      if (res) {
        setStatusData(res)
        if (action === 'create') {
          setActiveMode('deadlock')
          setActionNote({ tone: 'err', text: 'Real OS Deadlock triggered: P1 and P2 are mutually blocked on exclusive locks.' })
        } else if (action === 'prevent') {
          setActiveMode('prevented')
          setActionNote({ tone: 'ok', text: 'Dijkstra Resource Hierarchy enforced: both processes acquired locks in ascending order.' })
        } else if (action === 'resolve') {
          setActiveMode('resolved')
          setActionNote({ tone: 'warn', text: 'Victim process preempted and terminated — survivor P1 unblocked and finished.' })
        } else if (action === 'cleanup') {
          setActiveMode('idle')
          setStatusData(null)
          setActionNote({ tone: 'info', text: 'OS Lab locks and processes cleaned up.' })
        }
      }
    } catch (err) {
      setActionNote({ tone: 'err', text: `Action failed: ${err?.message || 'Backend unreachable'}` })
    } finally {
      setLoading(false)
    }
  }

  // Custom Sandbox Handlers
  const addCustomProcess = (labelOverride, subOverride) => {
    const name = (labelOverride || newProcName).trim()
    if (!name) return
    const nextIdx = customProcs.length + 1
    const id = `P_${Date.now().toString().slice(-4)}_${nextIdx}`
    const short = name.replace(/\.exe$/i, '').slice(0, 7)
    setCustomNodes(prev => [
      ...prev,
      { id, short, type: 'process', label: name, sub: subOverride || 'Custom Process' },
    ])
    setSelectedProc(id)
    setActionNote({ tone: 'info', text: `Added Process "${name}" to the graph.` })
    if (!labelOverride) setNewProcName('')
  }

  const addCustomResource = (labelOverride, subOverride) => {
    const name = (labelOverride || newResName).trim()
    if (!name) return
    const nextRank = customRess.length + 1
    const id = `R_${Date.now().toString().slice(-4)}_${nextRank}`
    setCustomNodes(prev => [
      ...prev,
      { id, short: `R_${nextRank}`, type: 'resource', label: name, sub: subOverride || `Rank #${nextRank} · Lock`, rank: nextRank },
    ])
    setSelectedRes(id)
    setActionNote({ tone: 'info', text: `Added Resource "${name}" (Rank #${nextRank}).` })
    if (!labelOverride) setNewResName('')
  }

  const removeCustomNode = nodeId => {
    const target = customNodes.find(n => n.id === nodeId)
    setCustomNodes(prev => prev.filter(n => n.id !== nodeId))
    setCustomEdges(prev => prev.filter(e => e.from !== nodeId && e.to !== nodeId))
    if (target) setActionNote({ tone: 'info', text: `Removed "${target.label}" and its connected edges.` })
  }

  const addCustomEdge = () => {
    if (!selectedProc || !selectedRes) return
    const procNode = customNodes.find(n => n.id === selectedProc)
    const resNode = customNodes.find(n => n.id === selectedRes)
    if (!procNode || !resNode) return

    // Enforce OS Mutual Exclusion: an exclusive resource cannot be HELD by two processes simultaneously
    if (edgeKind === 'hold') {
      const existingHolder = customEdges.find(e => e.from === selectedRes && e.kind === 'hold')
      if (existingHolder && existingHolder.to !== selectedProc) {
        const holderNode = customNodes.find(n => n.id === existingHolder.to)
        // Automatically convert to a WAIT edge because the lock is already taken!
        setCustomEdges(prev => {
          if (prev.some(e => e.from === selectedProc && e.to === selectedRes && e.kind === 'wait')) return prev
          return [...prev, { from: selectedProc, to: selectedRes, kind: 'wait', label: `WAITS ${resNode.short}` }]
        })
        setActionNote({
          tone: 'warn',
          text: `Mutual Exclusion: "${resNode.label}" is already held by "${holderNode?.label || existingHolder.to}". "${procNode.label}" must WAIT for it!`,
        })
        return
      }
      setCustomEdges(prev => {
        if (prev.some(e => e.from === selectedRes && e.to === selectedProc && e.kind === 'hold')) return prev
        return [...prev, { from: selectedRes, to: selectedProc, kind: 'hold', label: `HOLDS ${resNode.short}` }]
      })
      setActionNote({ tone: 'ok', text: `"${procNode.label}" acquired lock "${resNode.label}".` })
      return
    }

    // Wait edge: Process -> Resource
    setCustomEdges(prev => {
      if (prev.some(e => e.from === selectedProc && e.to === selectedRes && e.kind === 'wait')) return prev
      return [...prev, { from: selectedProc, to: selectedRes, kind: 'wait', label: `WAITS ${resNode.short}` }]
    })
    setActionNote({ tone: 'warn', text: `"${procNode.label}" is now waiting for "${resNode.label}".` })
  }

  const removeCustomEdge = idx => {
    setCustomEdges(prev => prev.filter((_, i) => i !== idx))
  }

  const triggerCustomRuleBreak = () => {
    if (customProcs.length < 2 || customRess.length < 2) {
      setActionNote({ tone: 'err', text: 'Add at least 2 Processes and 2 Resources to create a Circular Wait deadlock.' })
      return
    }
    const p1 = customProcs[0]
    const p2 = customProcs[1]
    const r1 = customRess[0]
    const r2 = customRess[1]
    setCustomEdges([
      { from: r1.id, to: p1.id, kind: 'hold', label: `HOLDS ${r1.short}` },
      { from: p1.id, to: r2.id, kind: 'wait', label: `WAITS ${r2.short}` },
      { from: r2.id, to: p2.id, kind: 'hold', label: `HOLDS ${r2.short}` },
      { from: p2.id, to: r1.id, kind: 'wait', label: `WAITS ${r1.short}` },
    ])
    setActionNote({
      tone: 'err',
      text: `Rule Broken: ${p1.label} holds ${r1.label} & waits for ${r2.label}, while ${p2.label} holds ${r2.label} & waits for ${r1.label} → DEADLOCK!`,
    })
  }

  const applyCustomPrevention = () => {
    if (customProcs.length === 0 || customRess.length === 0) return
    const p1 = customProcs[0]
    const ordered = []
    customRess.forEach((r, idx) => {
      ordered.push({
        from: r.id,
        to: p1.id,
        kind: idx === 0 ? 'hold' : 'order',
        label: `Rank #${idx + 1} → ${p1.short}`,
      })
    })
    if (customProcs.length >= 2) {
      // P2 must request Rank #1 first without holding higher-rank locks!
      ordered.push({
        from: customProcs[1].id,
        to: customRess[0].id,
        kind: 'order',
        label: `Waits Rank #1 (Safe)`,
      })
    }
    setCustomEdges(ordered)
    setActionNote({
      tone: 'ok',
      text: 'Dijkstra Ordering Applied: All processes request locks in ascending rank (#1 → #2), making Circular Wait impossible.',
    })
  }

  const preemptCustomVictim = () => {
    if (!customCycle || customCycle.length === 0) return
    const victimProc = customNodes.find(n => n.type === 'process' && customCycle.includes(n.id))
    if (!victimProc) return
    skipNextEvalRef.current = true
    setCustomEdges(prev => prev.filter(e => e.from !== victimProc.id && e.to !== victimProc.id))
    setCustomCycle(null)
    setCustomState('resolved')
    setActionNote({
      tone: 'warn',
      text: `Victim "${victimProc.label}" preempted! Its held locks were released so remaining processes can finish.`,
    })
  }

  const resetCustomSandbox = () => {
    setCustomNodes(INITIAL_CUSTOM_NODES)
    setCustomEdges(INITIAL_CUSTOM_EDGES)
    setCustomCycle(null)
    setCustomState('idle')
    setActionNote({ tone: 'info', text: 'Custom Sandbox reset to default processes and locks.' })
  }

  const solveBanker = async () => {
    setBankerLoading(true)
    try {
      const res = await api.post('/api/deadlock/banker', bankerInput)
      setBankerResult(res)
    } catch (err) {
      setActionNote({ tone: 'err', text: `Banker's calculation failed: ${err?.message || 'error'}` })
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

  // Accurate Coffman Hold & Wait check in Custom Mode
  const customHoldAndWait = useMemo(() => {
    if (labMode !== 'custom') return isDeadlock
    const holdingProcs = new Set(customEdges.filter(e => e.kind === 'hold').map(e => e.to))
    const waitingProcs = new Set(customEdges.filter(e => e.kind === 'wait').map(e => e.from))
    return [...holdingProcs].some(p => waitingProcs.has(p))
  }, [labMode, customEdges, isDeadlock])

  const hasMutualExclusion = labMode === 'custom' ? customRess.length > 0 && customEdges.some(e => e.kind === 'hold') : true

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
          background: 'linear-gradient(135deg, rgba(22, 25, 36, 0.8) 0%, rgba(16, 185, 129, 0.06) 100%)',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
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
              Real OS lock simulation, Live PC Custom Rule-Breaker Sandbox, Dijkstra&apos;s Ordering, and Banker&apos;s Algorithm.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
            {/* Mode Switcher */}
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
                onClick={() => {
                  setLabMode('kernel')
                  setActionNote(null)
                }}
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
                <Terminal size={13} /> OS Kernel Lab
              </button>
              <button
                onClick={() => {
                  setLabMode('custom')
                  setActionNote(null)
                }}
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
                <Btn onClick={resetCustomSandbox} title="Reset Custom Graph">
                  <RotateCcw size={14} /> Reset
                </Btn>
              </div>
            )}
          </div>
        </div>

        {/* Live Action Feedback Strip */}
        {actionNote && (
          <div
            style={{
              marginTop: 12,
              padding: '8px 12px',
              borderRadius: 8,
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background:
                actionNote.tone === 'err'
                  ? 'rgba(244, 63, 94, 0.14)'
                  : actionNote.tone === 'ok'
                  ? 'rgba(16, 185, 129, 0.14)'
                  : actionNote.tone === 'warn'
                  ? 'rgba(245, 158, 11, 0.14)'
                  : 'rgba(56, 189, 248, 0.14)',
              border: `1px solid ${
                actionNote.tone === 'err'
                  ? 'rgba(244, 63, 94, 0.35)'
                  : actionNote.tone === 'ok'
                  ? 'rgba(16, 185, 129, 0.35)'
                  : actionNote.tone === 'warn'
                  ? 'rgba(245, 158, 11, 0.35)'
                  : 'rgba(56, 189, 248, 0.35)'
              }`,
              color: 'var(--fg)',
            }}
          >
            <Info size={14} />
            <span>{actionNote.text}</span>
          </div>
        )}
      </div>

      {/* ── Custom & Real-PC Deadlock Builder Panel (Clean 3-Step Format) ── */}
      {labMode === 'custom' && (
        <div
          style={{
            ...glassCardStyle,
            position: 'relative',
            zIndex: 1,
            borderColor: 'rgba(167, 139, 250, 0.32)',
            background: 'linear-gradient(135deg, rgba(24, 24, 38, 0.74) 0%, rgba(56, 189, 248, 0.05) 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Monitor size={16} color="#c4b5fd" />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg)' }}>
                3-Step Live PC &amp; Custom Deadlock Builder
              </span>
              <Badge v="REAL PC DATA" tone="p" />
            </div>
            <Btn variant="secondary" onClick={refreshProcs} loading={procLoading}>
              <RefreshCw size={12} /> Refresh Live PC Processes
            </Btn>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(265px, 1fr))', gap: 14 }}>
            {/* Step 1: Processes */}
            <div style={{ padding: 14, borderRadius: 11, background: 'rgba(10, 12, 18, 0.58)', border: '1px solid rgba(56, 189, 248, 0.22)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', marginBottom: 8 }}>
                STEP 1 · PICK OR ADD PROCESSES
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <input
                  className="in"
                  style={{ flex: 1, marginRight: 0 }}
                  placeholder="Custom name (e.g. chrome.exe)"
                  value={newProcName}
                  onChange={e => setNewProcName(e.target.value)}
                />
                <Btn onClick={() => addCustomProcess()}>
                  <Plus size={13} /> Add
                </Btn>
              </div>
              <div style={{ fontSize: 10, color: 'var(--dim)', marginBottom: 6 }}>
                Live running PC processes (click to add):
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, maxHeight: 88, overflowY: 'auto' }}>
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
                        border: '1px solid rgba(56, 189, 248, 0.3)',
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

            {/* Step 2: Resources */}
            <div style={{ padding: 14, borderRadius: 11, background: 'rgba(10, 12, 18, 0.58)', border: '1px solid rgba(167, 139, 250, 0.22)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', marginBottom: 8 }}>
                STEP 2 · ADD RESOURCE LOCKS (RANKED)
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <input
                  className="in"
                  style={{ flex: 1, marginRight: 0 }}
                  placeholder="Custom lock (e.g. File Mutex)"
                  value={newResName}
                  onChange={e => setNewResName(e.target.value)}
                />
                <Btn onClick={() => addCustomResource()}>
                  <Plus size={13} /> Add
                </Btn>
              </div>
              <div style={{ fontSize: 10, color: 'var(--dim)', marginBottom: 6 }}>
                Common PC system locks (click to add):
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
                      border: '1px solid rgba(167, 139, 250, 0.3)',
                      color: '#ddd6fe',
                      cursor: 'pointer',
                    }}
                  >
                    + {r.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 3: Clean Bipartite Rule Connector */}
            <div style={{ padding: 14, borderRadius: 11, background: 'rgba(10, 12, 18, 0.58)', border: '1px solid rgba(245, 158, 11, 0.24)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', marginBottom: 8 }}>
                STEP 3 · ASSIGN HOLD OR WAIT RULE
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                <select
                  className="in"
                  style={{ marginRight: 0, width: '100%' }}
                  value={selectedProc}
                  onChange={e => setSelectedProc(e.target.value)}
                >
                  {customProcs.map(p => (
                    <option key={p.id} value={p.id}>Proc: {p.label}</option>
                  ))}
                </select>
                <select
                  className="in"
                  style={{ marginRight: 0, width: '100%' }}
                  value={selectedRes}
                  onChange={e => setSelectedRes(e.target.value)}
                >
                  {customRess.map(r => (
                    <option key={r.id} value={r.id}>Lock: {r.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <select
                  className="in"
                  style={{ flex: 1, marginRight: 0 }}
                  value={edgeKind}
                  onChange={e => setEdgeKind(e.target.value)}
                >
                  <option value="hold">Process HOLDS Lock (R → P)</option>
                  <option value="wait">Process WAITS FOR Lock (P → R)</option>
                </select>
                <Btn variant="primary" onClick={addCustomEdge}>
                  <Plus size={13} /> Connect
                </Btn>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, maxHeight: 62, overflowY: 'auto' }}>
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

          {/* Active Nodes Chips */}
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

        {/* Right: Coffman Conditions + Hierarchy Sequence */}
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
                badge={<Badge v={hasMutualExclusion ? 'ACTIVE' : 'STANDBY'} tone={hasMutualExclusion ? 'r' : 'c'} />}
                accent="#34d399"
                desc="Locks are exclusive; only one process can hold a lock at a time."
              />
              <CoffmanRow
                icon={<AlertTriangle size={15} color={customHoldAndWait ? '#fb7185' : '#85858b'} />}
                title="2. Hold & Wait"
                badge={<Badge v={customHoldAndWait ? 'ACTIVE' : 'INACTIVE'} tone={customHoldAndWait ? 'r' : 'g'} />}
                accent={customHoldAndWait ? '#fb7185' : '#4cc38a'}
                desc={
                  customHoldAndWait
                    ? 'At least one process holds a lock while waiting for another held lock.'
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

        {/* Tab 1: Banker's Algorithm + Step-by-Step Sequence Timeline */}
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
