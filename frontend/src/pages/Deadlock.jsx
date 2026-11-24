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
# Real OS Deadlock using POSIX flock circular wait
LOCK_DIR="/tmp/guardian_deadlock"
RES_A="$LOCK_DIR/resource_A.lock"
RES_B="$LOCK_DIR/resource_B.lock"

( exec 200>"$RES_A"; flock -x 200; sleep 1.2; exec 201>"$RES_B"; flock -x 201 ) &
( exec 201>"$RES_B"; flock -x 201; sleep 1.2; exec 200>"$RES_A"; flock -x 200 ) &`,

  prevent: `#!/usr/bin/env bash
# Dijkstra / Havender Ordering: F(R_A) = 1 < F(R_B) = 2
( exec 200>"$RES_A" && flock -x 200; exec 201>"$RES_B" && flock -x 201; flock -u 201 && flock -u 200 ) &
( sleep 0.2; exec 200>"$RES_A" && flock -x 200; exec 201>"$RES_B" && flock -x 201; flock -u 201 && flock -u 200 ) &`,

  resolve: `#!/usr/bin/env bash
# Victim Preemption Recovery
P2_PID=$(tail -n1 /tmp/guardian_deadlock/pids.txt)
kill -15 "$P2_PID" 2>/dev/null || kill -9 "$P2_PID"`,
}

const SAFE_BANKER_PRESET = {
  available: [3, 3, 2],
  maximum: [[7, 5, 3], [3, 2, 2], [9, 0, 2], [2, 2, 2], [4, 3, 3]],
  allocation: [[0, 1, 0], [2, 0, 0], [3, 0, 2], [2, 1, 1], [0, 0, 2]],
}

const UNSAFE_BANKER_PRESET = {
  available: [0, 0, 1],
  maximum: [[7, 5, 3], [3, 2, 2], [9, 0, 2], [2, 2, 2], [4, 3, 3]],
  allocation: [[0, 1, 0], [2, 0, 0], [3, 0, 2], [2, 1, 1], [0, 0, 2]],
}

const REAL_PC_RESOURCE_TEMPLATES = [
  { name: 'SQLite DB Lock', sub: 'guardian.db' },
  { name: 'Port 8000', sub: 'TCP :8000' },
  { name: 'GPU Mutex', sub: 'VRAM Handle' },
  { name: 'Config Lock', sub: 'watchlist.conf' },
]

const INITIAL_CUSTOM_NODES = [
  { id: 'P1', short: 'P1', type: 'process', label: 'Process P1', sub: 'Task #1' },
  { id: 'P2', short: 'P2', type: 'process', label: 'Process P2', sub: 'Task #2' },
  { id: 'R1', short: 'R_1', type: 'resource', label: 'SQLite DB Lock', sub: 'Rank #1', rank: 1 },
  { id: 'R2', short: 'R_2', type: 'resource', label: 'Port 8000', sub: 'Rank #2', rank: 2 },
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

// Unslop quiet-chrome glass surface
const panelStyle = {
  background: 'rgba(25, 25, 27, 0.78)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid var(--line)',
  borderRadius: 12,
  padding: '14px 16px',
}

export default function Deadlock({ src }) {
  const [labMode, setLabMode] = useState('kernel')
  const [activeMode, setActiveMode] = useState('idle')
  const [statusData, setStatusData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('simulator')
  const [codeType, setCodeType] = useState('create')
  const [copied, setCopied] = useState(false)
  const [actionNote, setActionNote] = useState(null)

  const { data: procScan, loading: procLoading, run: refreshProcs } = useScan('process', src || 'windows', true)
  const liveProcesses = useMemo(() => {
    const rows = procScan?.rows || []
    return [...rows].sort((a, b) => (Number(b.cpu) || 0) - (Number(a.cpu) || 0)).slice(0, 10)
  }, [procScan])

  const [customNodes, setCustomNodes] = useState(INITIAL_CUSTOM_NODES)
  const [customEdges, setCustomEdges] = useState(INITIAL_CUSTOM_EDGES)
  const [customCycle, setCustomCycle] = useState(null)
  const [customState, setCustomState] = useState('idle')
  const skipNextEvalRef = useRef(false)

  const customProcs = useMemo(() => customNodes.filter(n => n.type === 'process'), [customNodes])
  const customRess = useMemo(() => customNodes.filter(n => n.type === 'resource'), [customNodes])

  const [newProcName, setNewProcName] = useState('')
  const [newResName, setNewResName] = useState('')
  const [selectedProc, setSelectedProc] = useState('P1')
  const [edgeKind, setEdgeKind] = useState('wait')
  const [selectedRes, setSelectedRes] = useState('R2')

  const effectiveProc = customProcs.some(p => p.id === selectedProc) ? selectedProc : (customProcs[0]?.id || '')
  const effectiveRes = customRess.some(r => r.id === selectedRes) ? selectedRes : (customRess[0]?.id || '')

  const [bankerInput, setBankerInput] = useState(SAFE_BANKER_PRESET)
  const [bankerResult, setBankerResult] = useState(null)
  const [bankerLoading, setBankerLoading] = useState(false)

  useEffect(() => {
    let active = true
    api.post(`/api/deadlock/action/status?source=${src || 'linux'}`)
      .then(res => {
        if (active && res && res.mode) {
          setStatusData(res)
          setActiveMode(res.mode)
        }
      })
      .catch(() => {})
    return () => { active = false }
  }, [src])

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
    if (foundCycle && foundCycle.length > 0) setCustomState('deadlock')
    else if (edgesList.some(e => e.kind === 'order')) setCustomState('prevented')
    else setCustomState('idle')
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
        setActionNote({ tone: 'err', text: `Error: ${res.error}` })
        return
      }
      if (res) {
        setStatusData(res)
        if (action === 'create') {
          setActiveMode('deadlock')
          setActionNote({ tone: 'err', text: 'OS Deadlock active (P1 ⇄ P2).' })
        } else if (action === 'prevent') {
          setActiveMode('prevented')
          setActionNote({ tone: 'ok', text: 'Hierarchy order enforced (no cycle).' })
        } else if (action === 'resolve') {
          setActiveMode('resolved')
          setActionNote({ tone: 'warn', text: 'Victim preempted; survivor unblocked.' })
        } else if (action === 'cleanup') {
          setActiveMode('idle')
          setStatusData(null)
          setActionNote(null)
        }
      }
    } catch (err) {
      setActionNote({ tone: 'err', text: err?.message || 'Backend error' })
    } finally {
      setLoading(false)
    }
  }

  const addCustomProcess = (labelOverride, subOverride) => {
    const name = (labelOverride || newProcName).trim()
    if (!name) return
    const nextIdx = customProcs.length + 1
    const id = `P_${Date.now().toString().slice(-4)}_${nextIdx}`
    const short = name.replace(/\.exe$/i, '').slice(0, 7)
    setCustomNodes(prev => [...prev, { id, short, type: 'process', label: name, sub: subOverride || 'Process' }])
    setSelectedProc(id)
    if (!labelOverride) setNewProcName('')
  }

  const addCustomResource = (labelOverride, subOverride) => {
    const name = (labelOverride || newResName).trim()
    if (!name) return
    const nextRank = customRess.length + 1
    const id = `R_${Date.now().toString().slice(-4)}_${nextRank}`
    setCustomNodes(prev => [...prev, { id, short: `R_${nextRank}`, type: 'resource', label: name, sub: subOverride || `Rank #${nextRank}`, rank: nextRank }])
    setSelectedRes(id)
    if (!labelOverride) setNewResName('')
  }

  const removeCustomNode = nodeId => {
    setCustomNodes(prev => prev.filter(n => n.id !== nodeId))
    setCustomEdges(prev => prev.filter(e => e.from !== nodeId && e.to !== nodeId))
  }

  const addCustomEdge = () => {
    if (!effectiveProc || !effectiveRes) return
    const procNode = customNodes.find(n => n.id === effectiveProc)
    const resNode = customNodes.find(n => n.id === effectiveRes)
    if (!procNode || !resNode) return

    if (edgeKind === 'hold') {
      const existingHolder = customEdges.find(e => e.from === effectiveRes && e.kind === 'hold')
      if (existingHolder && existingHolder.to !== effectiveProc) {
        const holderNode = customNodes.find(n => n.id === existingHolder.to)
        setCustomEdges(prev => {
          if (prev.some(e => e.from === effectiveProc && e.to === effectiveRes && e.kind === 'wait')) return prev
          return [...prev, { from: effectiveProc, to: effectiveRes, kind: 'wait', label: `WAITS ${resNode.short}` }]
        })
        setActionNote({
          tone: 'warn',
          text: `${resNode.label} held by ${holderNode?.short || existingHolder.to} → ${procNode.short} set to WAIT.`,
        })
        return
      }
      setCustomEdges(prev => {
        if (prev.some(e => e.from === effectiveRes && e.to === effectiveProc && e.kind === 'hold')) return prev
        return [...prev, { from: effectiveRes, to: effectiveProc, kind: 'hold', label: `HOLDS ${resNode.short}` }]
      })
      setActionNote(null)
      return
    }

    setCustomEdges(prev => {
      if (prev.some(e => e.from === effectiveProc && e.to === effectiveRes && e.kind === 'wait')) return prev
      return [...prev, { from: effectiveProc, to: effectiveRes, kind: 'wait', label: `WAITS ${resNode.short}` }]
    })
    setActionNote(null)
  }

  const removeCustomEdge = idx => setCustomEdges(prev => prev.filter((_, i) => i !== idx))

  const triggerCustomRuleBreak = () => {
    if (customProcs.length < 2 || customRess.length < 2) {
      setActionNote({ tone: 'err', text: 'Need 2+ processes and 2+ locks.' })
      return
    }
    const [p1, p2] = customProcs
    const [r1, r2] = customRess
    setCustomEdges([
      { from: r1.id, to: p1.id, kind: 'hold', label: `HOLDS ${r1.short}` },
      { from: p1.id, to: r2.id, kind: 'wait', label: `WAITS ${r2.short}` },
      { from: r2.id, to: p2.id, kind: 'hold', label: `HOLDS ${r2.short}` },
      { from: p2.id, to: r1.id, kind: 'wait', label: `WAITS ${r1.short}` },
    ])
    setActionNote({ tone: 'err', text: `Cycle created: ${p1.short} ⇄ ${p2.short}` })
  }

  const applyCustomPrevention = () => {
    if (customProcs.length === 0 || customRess.length === 0) return
    const p1 = customProcs[0]
    const ordered = customRess.map((r, idx) => ({
      from: r.id,
      to: p1.id,
      kind: idx === 0 ? 'hold' : 'order',
      label: `#${idx + 1} → ${p1.short}`,
    }))
    if (customProcs.length >= 2) {
      ordered.push({ from: customProcs[1].id, to: customRess[0].id, kind: 'order', label: 'Ordered Safe' })
    }
    setCustomEdges(ordered)
    setActionNote({ tone: 'ok', text: 'Ascending rank order enforced.' })
  }

  const preemptCustomVictim = () => {
    if (!customCycle || customCycle.length === 0) return
    const victimProc = customNodes.find(n => n.type === 'process' && customCycle.includes(n.id))
    if (!victimProc) return
    skipNextEvalRef.current = true
    setCustomEdges(prev => prev.filter(e => e.from !== victimProc.id && e.to !== victimProc.id))
    setCustomCycle(null)
    setCustomState('resolved')
    setActionNote({ tone: 'warn', text: `Victim "${victimProc.short}" preempted.` })
  }

  const resetCustomSandbox = () => {
    setCustomNodes(INITIAL_CUSTOM_NODES)
    setCustomEdges(INITIAL_CUSTOM_EDGES)
    setCustomCycle(null)
    setCustomState('idle')
    setActionNote(null)
  }

  const solveBanker = async () => {
    setBankerLoading(true)
    try {
      const res = await api.post('/api/deadlock/banker', bankerInput)
      setBankerResult(res)
    } catch (err) {
      setActionNote({ tone: 'err', text: err?.message || 'Calculation failed' })
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

  const customHoldAndWait = useMemo(() => {
    if (labMode !== 'custom') return isDeadlock
    const holdingProcs = new Set(customEdges.filter(e => e.kind === 'hold').map(e => e.to))
    const waitingProcs = new Set(customEdges.filter(e => e.kind === 'wait').map(e => e.from))
    return [...holdingProcs].some(p => waitingProcs.has(p))
  }, [labMode, customEdges, isDeadlock])

  const hasMutualExclusion = labMode === 'custom' ? customRess.length > 0 && customEdges.some(e => e.kind === 'hold') : true

  const statusBadge = isDeadlock
    ? { v: 'DEADLOCK', tone: 'r' }
    : isPrevented
    ? { v: 'PREVENTED', tone: 'g' }
    : isResolved
    ? { v: 'RECOVERED', tone: 'a' }
    : { v: 'IDLE', tone: 'c' }

  const accentBorderColor = isDeadlock ? 'var(--r)' : isPrevented ? 'var(--g)' : isResolved ? 'var(--a)' : 'var(--c)'

  const needMatrix = bankerInput.maximum.map((row, i) =>
    row.map((val, j) => Math.max(0, val - (bankerInput.allocation[i]?.[j] || 0)))
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── Compact Single-Row Header & Side-by-Side Controls ── */}
      <div
        style={{
          ...panelStyle,
          borderLeft: `3px solid ${accentBorderColor}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <GitBranch size={18} color="var(--accent)" />
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--fg)', letterSpacing: '-0.01em' }}>
            Deadlock Engineering Lab
          </h1>
          <Badge v={statusBadge.v} tone={statusBadge.tone} />
        </div>

        {/* All Mode + Action Buttons neatly side-by-side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'inline-flex',
              padding: 3,
              borderRadius: 7,
              background: 'var(--bg)',
              border: '1px solid var(--line)',
              gap: 2,
            }}
          >
            <button
              onClick={() => { setLabMode('kernel'); setActionNote(null) }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 10px',
                borderRadius: 5,
                border: 'none',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                background: labMode === 'kernel' ? 'rgba(16, 185, 129, 0.18)' : 'transparent',
                color: labMode === 'kernel' ? 'var(--g)' : 'var(--dim)',
              }}
            >
              <Terminal size={12} /> OS Kernel
            </button>
            <button
              onClick={() => { setLabMode('custom'); setActionNote(null) }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 10px',
                borderRadius: 5,
                border: 'none',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                background: labMode === 'custom' ? 'rgba(167, 139, 250, 0.2)' : 'transparent',
                color: labMode === 'custom' ? 'var(--p)' : 'var(--dim)',
              }}
            >
              <Sliders size={12} /> Custom PC
            </button>
          </div>

          {labMode === 'kernel' ? (
            <>
              <Btn
                onClick={() => runAction('create')}
                disabled={loading || isDeadlock}
                style={{ background: 'rgba(229, 72, 77, 0.14)', color: 'var(--r)', border: '1px solid rgba(229, 72, 77, 0.35)' }}
              >
                <Play size={13} /> Trigger OS Deadlock
              </Btn>
              <Btn
                onClick={() => runAction('prevent')}
                disabled={loading}
                style={{ background: 'rgba(76, 195, 138, 0.14)', color: 'var(--g)', border: '1px solid rgba(76, 195, 138, 0.35)' }}
              >
                <ShieldCheck size={13} /> Prevent
              </Btn>
              <Btn
                onClick={() => runAction('resolve')}
                disabled={loading || !isDeadlock}
                style={{ background: 'rgba(245, 158, 11, 0.14)', color: 'var(--a)', border: '1px solid rgba(245, 158, 11, 0.35)' }}
              >
                <Zap size={13} /> Preempt
              </Btn>
              <Btn onClick={() => runAction('cleanup')} disabled={loading} title="Reset">
                <RotateCcw size={13} />
              </Btn>
            </>
          ) : (
            <>
              <Btn
                onClick={triggerCustomRuleBreak}
                style={{ background: 'rgba(229, 72, 77, 0.14)', color: 'var(--r)', border: '1px solid rgba(229, 72, 77, 0.35)' }}
              >
                <AlertTriangle size={13} /> Break Rule
              </Btn>
              <Btn
                onClick={applyCustomPrevention}
                style={{ background: 'rgba(76, 195, 138, 0.14)', color: 'var(--g)', border: '1px solid rgba(76, 195, 138, 0.35)' }}
              >
                <ShieldCheck size={13} /> Order Rules
              </Btn>
              <Btn
                onClick={preemptCustomVictim}
                disabled={!isDeadlock}
                style={{ background: 'rgba(245, 158, 11, 0.14)', color: 'var(--a)', border: '1px solid rgba(245, 158, 11, 0.35)' }}
              >
                <Zap size={13} /> Preempt
              </Btn>
              <Btn onClick={resetCustomSandbox} title="Reset">
                <RotateCcw size={13} />
              </Btn>
            </>
          )}
        </div>
      </div>

      {/* Compact Action Note (only when triggered) */}
      {actionNote && (
        <div
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--panel)',
            border: `1px solid ${actionNote.tone === 'err' ? 'var(--r)' : actionNote.tone === 'ok' ? 'var(--g)' : actionNote.tone === 'warn' ? 'var(--a)' : 'var(--c)'}`,
            color: 'var(--fg)',
          }}
        >
          <Info size={14} />
          <span>{actionNote.text}</span>
        </div>
      )}

      {/* ── Compact 3-Step Builder (Custom PC Mode) ── */}
      {labMode === 'custom' && (
        <div style={panelStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Monitor size={15} color="var(--p)" />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg)' }}>Custom PC Builder</span>
              <Badge v="LIVE PC" tone="p" />
            </div>
            <Btn variant="secondary" onClick={refreshProcs} loading={procLoading}>
              <RefreshCw size={12} /> Refresh PC
            </Btn>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
            {/* Step 1 */}
            <div style={{ padding: 12, borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--line)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--c)', marginBottom: 8 }}>1. Processes</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <input
                  className="in"
                  style={{ flex: 1, marginRight: 0 }}
                  placeholder="e.g. chrome.exe"
                  value={newProcName}
                  onChange={e => setNewProcName(e.target.value)}
                />
                <Btn onClick={() => addCustomProcess()}><Plus size={12} /></Btn>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 72, overflowY: 'auto' }}>
                {liveProcesses.map((p, idx) => (
                  <button
                    key={`${p.pid}-${idx}`}
                    onClick={() => addCustomProcess(p.name, `PID ${p.pid}`)}
                    className="mono"
                    style={{
                      padding: '2px 6px',
                      borderRadius: 4,
                      fontSize: 10,
                      background: 'rgba(56, 189, 248, 0.1)',
                      border: '1px solid rgba(56, 189, 248, 0.25)',
                      color: 'var(--c)',
                      cursor: 'pointer',
                    }}
                  >
                    +{p.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2 */}
            <div style={{ padding: 12, borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--line)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--p)', marginBottom: 8 }}>2. Resource Locks</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <input
                  className="in"
                  style={{ flex: 1, marginRight: 0 }}
                  placeholder="e.g. File Mutex"
                  value={newResName}
                  onChange={e => setNewResName(e.target.value)}
                />
                <Btn onClick={() => addCustomResource()}><Plus size={12} /></Btn>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {REAL_PC_RESOURCE_TEMPLATES.map(r => (
                  <button
                    key={r.name}
                    onClick={() => addCustomResource(r.name, r.sub)}
                    className="mono"
                    style={{
                      padding: '2px 6px',
                      borderRadius: 4,
                      fontSize: 10,
                      background: 'rgba(167, 139, 250, 0.1)',
                      border: '1px solid rgba(167, 139, 250, 0.25)',
                      color: 'var(--p)',
                      cursor: 'pointer',
                    }}
                  >
                    +{r.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 3 */}
            <div style={{ padding: 12, borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--line)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--a)', marginBottom: 8 }}>3. Connect Hold / Wait</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
                <select className="in" style={{ marginRight: 0, width: '100%' }} value={effectiveProc} onChange={e => setSelectedProc(e.target.value)}>
                  {customProcs.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
                <select className="in" style={{ marginRight: 0, width: '100%' }} value={effectiveRes} onChange={e => setSelectedRes(e.target.value)}>
                  {customRess.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <select className="in" style={{ flex: 1, marginRight: 0 }} value={edgeKind} onChange={e => setEdgeKind(e.target.value)}>
                  <option value="hold">HOLDS (R → P)</option>
                  <option value="wait">WAITS (P → R)</option>
                </select>
                <Btn variant="primary" onClick={addCustomEdge}><Plus size={12} /> Link</Btn>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 48, overflowY: 'auto' }}>
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
                        gap: 4,
                        padding: '1px 6px',
                        borderRadius: 4,
                        fontSize: 10,
                        background: e.kind === 'wait' ? 'rgba(229,72,77,0.14)' : 'rgba(76,195,138,0.14)',
                        color: e.kind === 'wait' ? 'var(--r)' : 'var(--g)',
                      }}
                    >
                      {fn}→{tn}
                      <button onClick={() => removeCustomEdge(idx)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}>
                        <Trash2 size={9} />
                      </button>
                    </span>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Active Nodes */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {customNodes.map(n => (
              <span
                key={n.id}
                className="mono"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '2px 8px',
                  borderRadius: 999,
                  fontSize: 11,
                  background: 'var(--bg)',
                  border: '1px solid var(--line)',
                  color: 'var(--fg)',
                }}
              >
                {n.label}
                {customNodes.length > 2 && (
                  <button onClick={() => removeCustomNode(n.id)} style={{ background: 'none', border: 'none', color: 'var(--r)', cursor: 'pointer', padding: 0 }}>
                    <Trash2 size={10} />
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Main 2-Column Stage ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', fontSize: 12 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'var(--fg)' }}>
              <Cpu size={14} color="var(--accent)" /> Resource Allocation Graph (RAG)
            </span>
            <span className="mono dim" style={{ fontSize: 11 }}>
              {labMode === 'custom' ? `${customProcs.length} Procs · ${customRess.length} Locks` : 'POSIX flock'}
            </span>
          </div>

          <Deadlock3D
            mode={effectiveMode}
            p1State={statusData?.p1}
            p2State={statusData?.p2}
            cycle={labMode === 'custom' ? customCycle : statusData?.cycle}
            customNodes={labMode === 'custom' ? customNodes : null}
            customEdges={labMode === 'custom' ? customEdges : null}
            height={420}
          />

          <div style={{ ...panelStyle, padding: '10px 14px', borderLeft: `3px solid ${accentBorderColor}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity size={14} color={accentBorderColor} />
              <span className="mono" style={{ fontSize: 11, color: 'var(--fg)' }}>
                {isDeadlock
                  ? customCycle
                    ? `Cycle: ${customCycle.join(' → ')}`
                    : 'Deadlock: P1 ⇄ P2 blocked'
                  : isPrevented
                  ? 'Safe: Ordered lock acquisition'
                  : isResolved
                  ? 'Recovered: Victim preempted'
                  : 'Idle: No lock cycle'}
              </span>
            </div>
            {labMode === 'kernel' && statusData?.p1?.pid && (
              <Badge v={`P1:${statusData.p1.pid} · P2:${statusData.p2?.pid || 'Killed'}`} tone="p" />
            )}
          </div>
        </div>

        {/* Right: Concise Coffman Conditions + Hierarchy */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={panelStyle}>
            <h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: 'var(--fg)', borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
              Coffman Conditions Forensics
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CoffmanRow
                icon={<Lock size={14} color="var(--g)" />}
                title="1. Mutual Exclusion"
                badge={<Badge v={hasMutualExclusion ? 'ACTIVE' : 'STANDBY'} tone={hasMutualExclusion ? 'r' : 'c'} />}
                accent="var(--g)"
                desc="Exclusive lock per resource."
              />
              <CoffmanRow
                icon={<AlertTriangle size={14} color={customHoldAndWait ? 'var(--r)' : 'var(--dim)'} />}
                title="2. Hold & Wait"
                badge={<Badge v={customHoldAndWait ? 'ACTIVE' : 'INACTIVE'} tone={customHoldAndWait ? 'r' : 'g'} />}
                accent={customHoldAndWait ? 'var(--r)' : 'var(--g)'}
                desc={customHoldAndWait ? 'Holding lock while waiting.' : 'No simultaneous hold & wait.'}
              />
              <CoffmanRow
                icon={<ShieldAlert size={14} color={isResolved ? 'var(--g)' : 'var(--a)'} />}
                title="3. No Preemption"
                badge={<Badge v={isResolved ? 'BROKEN' : 'ACTIVE'} tone={isResolved ? 'g' : 'a'} />}
                accent={isResolved ? 'var(--g)' : 'var(--a)'}
                desc={isResolved ? 'Victim terminated & freed.' : 'Kernel awaits release.'}
              />
              <CoffmanRow
                icon={isPrevented ? <CheckCircle2 size={14} color="var(--g)" /> : isDeadlock ? <XCircle size={14} color="var(--r)" /> : <Lock size={14} color="var(--c)" />}
                title="4. Circular Wait"
                badge={<Badge v={isDeadlock ? 'CYCLE' : isPrevented ? 'ORDERED' : 'CLEARED'} tone={isDeadlock ? 'r' : 'g'} />}
                accent={isDeadlock ? 'var(--r)' : 'var(--g)'}
                desc={isPrevented ? 'Ascending rank order.' : isDeadlock ? 'Wait cycle confirmed.' : 'Acyclic graph.'}
              />
            </div>
          </div>

          <div style={panelStyle}>
            <h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: 'var(--fg)', borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
              Lock Hierarchy Sequence
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
              {(labMode === 'custom' ? customRess : [{ id: 'RA', label: 'R_A' }, { id: 'RB', label: 'R_B' }]).map((r, i, arr) => (
                <span key={r.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Badge v={`#${i + 1} ${r.label}`} tone={isDeadlock ? 'r' : 'g'} />
                  {i < arr.length - 1 && <ArrowRight size={12} color="var(--dim)" />}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Concise Bottom Tabs ── */}
      <div style={{ ...panelStyle, padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 8, padding: '8px 16px 0', background: 'var(--bar-bg)', borderBottom: '1px solid var(--line)' }}>
          <TabBtn active={activeTab === 'simulator'} onClick={() => setActiveTab('simulator')} icon={<Calculator size={13} color="var(--g)" />} label="Banker's Algorithm" />
          <TabBtn active={activeTab === 'code'} onClick={() => setActiveTab('code')} icon={<Terminal size={13} color="var(--c)" />} label="Bash Source" />
          <TabBtn active={activeTab === 'theory'} onClick={() => setActiveTab('theory')} icon={<BookOpen size={13} color="var(--p)" />} label="OS Theory" />
        </div>

        {activeTab === 'simulator' && (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)' }}>Dijkstra&apos;s Banker&apos;s Safety Check</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Btn variant="secondary" onClick={() => { setBankerInput(SAFE_BANKER_PRESET); setBankerResult(null) }}>Safe Preset</Btn>
                <Btn variant="secondary" onClick={() => { setBankerInput(UNSAFE_BANKER_PRESET); setBankerResult(null) }}>Unsafe Preset</Btn>
                <Btn variant="primary" onClick={solveBanker} disabled={bankerLoading}>
                  <RefreshCw size={13} className={bankerLoading ? 'spin' : ''} /> Compute Sequence
                </Btn>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
              <div style={{ padding: 12, borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--line)' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--g)', marginBottom: 8 }}>AVAILABLE [A, B, C]</div>
                <div style={{ display: 'flex', gap: 6 }}>
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
                      style={{ width: '100%', textAlign: 'center', padding: '6px 4px', borderRadius: 6, background: 'var(--panel)', border: '1px solid var(--line)', color: 'var(--g)', fontWeight: 700, fontSize: 14 }}
                    />
                  ))}
                </div>
              </div>

              <MatrixBox title="ALLOCATION" color="var(--c)" rows={bankerInput.allocation} />
              <MatrixBox title="MAX DEMAND" color="var(--p)" rows={bankerInput.maximum} />
              <MatrixBox title="NEED (MAX - ALLOC)" color="var(--a)" rows={needMatrix} />
            </div>

            {bankerResult && (
              <div style={{ padding: 14, borderRadius: 8, background: 'var(--bg)', border: `1px solid ${bankerResult.is_safe ? 'var(--g)' : 'var(--r)'}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: bankerResult.is_safe ? 'var(--g)' : 'var(--r)' }}>
                    {bankerResult.is_safe ? 'SAFE STATE' : 'UNSAFE STATE (DEADLOCK RISK)'}
                  </span>
                  {bankerResult.is_safe && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                      {bankerResult.safe_sequence.map((proc, idx) => (
                        <span key={proc} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <Badge v={proc} tone="g" />
                          {idx < bankerResult.safe_sequence.length - 1 && <ArrowRight size={11} color="var(--dim)" />}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {Array.isArray(bankerResult.steps) && bankerResult.steps.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8 }}>
                    {bankerResult.steps.map((st, idx) => (
                      <div key={st.process} style={{ padding: 10, borderRadius: 8, background: 'var(--panel)', border: '1px solid var(--line)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span className="mono dim" style={{ fontSize: 10 }}>#{idx + 1}</span>
                          <Badge v={st.process} tone="g" />
                        </div>
                        <div className="mono" style={{ fontSize: 10, color: 'var(--a)' }}>Need [{st.need.join(',')}] ≤ Work</div>
                        <div className="mono" style={{ fontSize: 10, color: 'var(--c)' }}>Work [{st.work_before.join(',')}] → [{st.work_after.join(',')}]</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'code' && (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <ScriptBtn active={codeType === 'create'} color="#e5484d" onClick={() => setCodeType('create')} label="deadlock_create.sh" />
                <ScriptBtn active={codeType === 'prevent'} color="#4cc38a" onClick={() => setCodeType('prevent')} label="deadlock_prevent.sh" />
                <ScriptBtn active={codeType === 'resolve'} color="#f59e0b" onClick={() => setCodeType('resolve')} label="deadlock_resolve.sh" />
              </div>
              <Btn variant="secondary" onClick={copyCode}>
                {copied ? <Check size={12} color="var(--g)" /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}
              </Btn>
            </div>
            <pre className="mono" style={{ margin: 0, padding: 12, borderRadius: 8, background: '#0d0d0f', border: '1px solid var(--line)', fontSize: 11, lineHeight: 1.6, overflowX: 'auto', color: 'var(--fg)' }}>
              {BASH_CODE_SNIPPETS[codeType]}
            </pre>
          </div>
        )}

        {activeTab === 'theory' && (
          <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            <TheoryCard title="1. Prevention (Havender)" color="var(--g)" body="Enforces F(R_1) < F(R_2) ascending lock order to break Circular Wait." />
            <TheoryCard title="2. Avoidance (Banker's)" color="var(--c)" body="Simulates allocation to guarantee a safe execution sequence exists." />
            <TheoryCard title="3. Detection (DFS)" color="var(--p)" body="Detects cycles in the Wait-For Graph built from active locks." />
            <TheoryCard title="4. Recovery (Preempt)" color="var(--a)" body="Terminates minimum-cost victim process to release blocked locks." />
          </div>
        )}
      </div>
    </div>
  )
}

function CoffmanRow({ icon, title, badge, accent, desc }) {
  return (
    <div style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--line)', borderLeft: `3px solid ${accent}`, display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--fg)' }}>{title}</span>
          {badge}
        </div>
        <div className="dim" style={{ fontSize: 11 }}>{desc}</div>
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
        gap: 6,
        padding: '8px 10px',
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
    <div style={{ padding: 12, borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--line)' }}>
      <div style={{ fontSize: 10, fontWeight: 600, color, marginBottom: 6 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {rows.map((row, idx) => (
          <div key={idx} className="mono" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <span className="dim">P{idx}</span>
            <span>[{row.join(', ')}]</span>
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
        padding: '4px 8px',
        borderRadius: 5,
        fontSize: 11,
        fontWeight: 600,
        cursor: 'pointer',
        background: active ? `${color}22` : 'transparent',
        color: active ? color : 'var(--dim)',
        border: `1px solid ${active ? color : 'var(--line)'}`,
      }}
    >
      {label}
    </button>
  )
}

function TheoryCard({ title, color, body }) {
  return (
    <div style={{ padding: 12, borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--line)', borderTop: `2px solid ${color}` }}>
      <div style={{ fontSize: 12, fontWeight: 600, color, marginBottom: 4 }}>{title}</div>
      <div className="dim" style={{ fontSize: 11, lineHeight: 1.45 }}>{body}</div>
    </div>
  )
}
