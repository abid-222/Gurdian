import { useState, useEffect, useCallback } from 'react'
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
  RefreshCw
} from 'lucide-react'
import { api } from '../api'
import { Badge, Btn, Card } from '../components/ui'
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
echo "Resource B preempted. Process P1 unblocked and completes critical section."`
}

export default function Deadlock({ src }) {
  const [activeMode, setActiveMode] = useState('idle') // 'idle' | 'deadlock' | 'prevented' | 'resolved'
  const [statusData, setStatusData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('simulator') // 'simulator' | 'code' | 'theory'
  const [codeType, setCodeType] = useState('create')

  // Banker's Algorithm State
  const [bankerInput, setBankerInput] = useState({
    available: [3, 3, 2],
    maximum: [
      [7, 5, 3],
      [3, 2, 2],
      [9, 0, 2],
      [2, 2, 2],
      [4, 3, 3]
    ],
    allocation: [
      [0, 1, 0],
      [2, 0, 0],
      [3, 0, 2],
      [2, 1, 1],
      [0, 0, 2]
    ]
  })
  const [bankerResult, setBankerResult] = useState(null)
  const [bankerLoading, setBankerLoading] = useState(false)

  // Fetch status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.post(`/api/deadlock/action/status?source=${src || 'linux'}`)
      if (res && res.mode) {
        setStatusData(res)
        setActiveMode(res.mode)
      }
    } catch {
      // In mock test mode or disconnected, status remains handled
    }
  }, [src])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  // Run Deadlock Action
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

  // Run Banker's Algorithm
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

  const isDeadlock = activeMode === 'deadlock'
  const isPrevented = activeMode === 'prevented'
  const isResolved = activeMode === 'resolved'

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold tracking-tight text-[var(--fg)]">Deadlock Engineering Lab</h1>
            <Badge variant={isDeadlock ? 'crit' : isPrevented ? 'low' : 'info'}>
              {isDeadlock ? 'DEADLOCK ACTIVE' : isPrevented ? 'PREVENTION VERIFIED' : isResolved ? 'RECOVERED' : 'SYSTEM IDLE'}
            </Badge>
          </div>
          <p className="text-xs text-[var(--muted)]">
            Real OS-level POSIX kernel lock simulation, Dijkstra&apos;s Resource Ordering prevention, and Banker&apos;s Avoidance Algorithm.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <Btn
            onClick={() => runAction('create')}
            disabled={loading || isDeadlock}
            className="bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20"
          >
            <Play className="w-3.5 h-3.5 mr-1 text-rose-400" />
            Trigger OS Deadlock (flock)
          </Btn>
          <Btn
            onClick={() => runAction('prevent')}
            disabled={loading}
            className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20"
          >
            <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-400" />
            Run Prevention (Ordering)
          </Btn>
          <Btn
            onClick={() => runAction('resolve')}
            disabled={loading || !isDeadlock}
            className="bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20"
          >
            <Zap className="w-3.5 h-3.5 mr-1 text-amber-400" />
            Break Deadlock (Preempt Victim)
          </Btn>
          <Btn
            onClick={() => runAction('cleanup')}
            disabled={loading}
            className="border border-[var(--border)] text-[var(--muted)] hover:text-[var(--fg)]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Btn>
        </div>
      </div>

      {/* Main Grid: 3D Visualization + Coffman Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: 3D Interactive Canvas */}
        <div className="lg:col-span-8 flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs font-mono text-[var(--muted)] px-1">
            <span className="flex items-center gap-1.5 text-[var(--fg)] font-semibold">
              <Cpu className="w-3.5 h-3.5 text-[var(--accent)]" /> 3D Resource Allocation Graph (RAG)
            </span>
            <span>OS Mechanism: POSIX flock (Linux /proc/locks)</span>
          </div>

          <Deadlock3D
            mode={activeMode}
            p1State={statusData?.p1}
            p2State={statusData?.p2}
            cycle={statusData?.cycle}
            height={440}
          />

          {/* Real-time Status Card */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md p-3 text-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-[var(--muted)]">Status:</span>
              <span className="font-mono font-medium text-[var(--fg)]">
                {isDeadlock
                  ? 'Kernel Deadlock Established · Process P1 and P2 blocked waiting on mutual locks.'
                  : isPrevented
                  ? 'Resource Hierarchy Enforced · P1 and P2 executed sequentially with zero circular wait.'
                  : isResolved
                  ? 'Victim Preempted · Survivor unblocked and finished critical section.'
                  : 'Idle · No conflicting lock requests active.'}
              </span>
            </div>
            {statusData?.p1?.pid && (
              <span className="font-mono text-[11px] text-[var(--muted)]">
                PIDs: P1={statusData.p1.pid} · P2={statusData.p2.pid || 'Terminated'}
              </span>
            )}
          </div>
        </div>

        {/* Right: Coffman's 4 Conditions Analyzer */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <Card title="Coffman Conditions Forensics">
            <p className="text-xs text-[var(--muted)] mb-3">
              Deadlock mathematically requires all 4 conditions to hold simultaneously:
            </p>

            <div className="space-y-2.5">
              {/* 1. Mutual Exclusion */}
              <div className="p-2.5 rounded border border-[var(--border)] bg-[#121214] flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <div className="text-xs">
                  <div className="font-medium text-[var(--fg)] flex items-center justify-between">
                    1. Mutual Exclusion
                    <Badge variant="crit">ACTIVE</Badge>
                  </div>
                  <div className="text-[var(--muted)] text-[11px] mt-0.5">
                    Resources (Lock A &amp; B) are exclusive via <code className="text-emerald-400">flock -x</code>.
                  </div>
                </div>
              </div>

              {/* 2. Hold and Wait */}
              <div className="p-2.5 rounded border border-[var(--border)] bg-[#121214] flex items-start gap-2.5">
                <AlertTriangle className={`w-4 h-4 ${isDeadlock ? 'text-rose-400' : 'text-[var(--muted)]'} mt-0.5 shrink-0`} />
                <div className="text-xs">
                  <div className="font-medium text-[var(--fg)] flex items-center justify-between">
                    2. Hold &amp; Wait
                    <Badge variant={isDeadlock ? 'crit' : 'low'}>{isDeadlock ? 'ACTIVE' : 'INACTIVE'}</Badge>
                  </div>
                  <div className="text-[var(--muted)] text-[11px] mt-0.5">
                    {isDeadlock
                      ? 'P1 holds Lock A waiting for B; P2 holds Lock B waiting for A.'
                      : 'Processes release or do not hold resources while waiting.'}
                  </div>
                </div>
              </div>

              {/* 3. No Preemption */}
              <div className="p-2.5 rounded border border-[var(--border)] bg-[#121214] flex items-start gap-2.5">
                <ShieldAlert className={`w-4 h-4 ${isResolved ? 'text-emerald-400' : 'text-amber-400'} mt-0.5 shrink-0`} />
                <div className="text-xs">
                  <div className="font-medium text-[var(--fg)] flex items-center justify-between">
                    3. No Preemption
                    <Badge variant={isResolved ? 'low' : 'crit'}>{isResolved ? 'BROKEN (PREEMPTED)' : 'ACTIVE'}</Badge>
                  </div>
                  <div className="text-[var(--muted)] text-[11px] mt-0.5">
                    {isResolved
                      ? 'Preemption algorithm forcibly terminated victim P2 to release lock.'
                      : 'Kernel does not seize locks without explicit release or termination.'}
                  </div>
                </div>
              </div>

              {/* 4. Circular Wait */}
              <div className="p-2.5 rounded border border-[var(--border)] bg-[#121214] flex items-start gap-2.5">
                {isPrevented ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                ) : isDeadlock ? (
                  <XCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                ) : (
                  <Lock className="w-4 h-4 text-[var(--muted)] mt-0.5 shrink-0" />
                )}
                <div className="text-xs">
                  <div className="font-medium text-[var(--fg)] flex items-center justify-between">
                    4. Circular Wait
                    <Badge variant={isDeadlock ? 'crit' : 'low'}>
                      {isDeadlock ? 'LOOP DETECTED' : isPrevented ? 'BROKEN BY RULE' : 'CLEARED'}
                    </Badge>
                  </div>
                  <div className="text-[var(--muted)] text-[11px] mt-0.5">
                    {isPrevented
                      ? 'Dijkstra hierarchy F(A)=1 < F(B)=2 eliminates circular dependency.'
                      : isDeadlock
                      ? 'P1 -> Res B -> P2 -> Res A -> P1 cycle confirmed in /proc/locks.'
                      : 'No circular wait cycles present.'}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Active OS Locks Card */}
          <Card title="Kernel Lock Registry (/proc/locks)">
            <div className="text-xs font-mono space-y-1.5">
              <div className="flex justify-between border-b border-[var(--border)] pb-1 text-[var(--muted)]">
                <span>Lock Inode</span>
                <span>Type</span>
                <span>Owner</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-[var(--fg)]">/tmp/resource_A.lock</span>
                <span className="text-emerald-400">FLOCK (EXCL)</span>
                <span className="text-[var(--fg)]">{isDeadlock ? statusData?.p1?.pid || 'P1' : isPrevented ? 'Free' : 'None'}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-[var(--fg)]">/tmp/resource_B.lock</span>
                <span className="text-emerald-400">FLOCK (EXCL)</span>
                <span className="text-[var(--fg)]">{isDeadlock ? statusData?.p2?.pid || 'P2' : isPrevented ? 'Free' : 'None'}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Deep-Dive Tabs: Banker's Algorithm, Linux Bash Code, Theory */}
      <div className="border border-[var(--border)] rounded-md bg-[var(--surface)] overflow-hidden">
        {/* Navigation Tabs */}
        <div className="flex border-b border-[var(--border)] bg-[#121214] px-4 pt-2 gap-4">
          <button
            onClick={() => setActiveTab('simulator')}
            className={`pb-2.5 text-xs font-medium flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'simulator'
                ? 'border-[var(--accent)] text-[var(--fg)]'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--fg)]'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" /> Banker&apos;s Algorithm Calculator
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className={`pb-2.5 text-xs font-medium flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'code'
                ? 'border-[var(--accent)] text-[var(--fg)]'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--fg)]'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" /> Real Linux Bash Source Code
          </button>
          <button
            onClick={() => setActiveTab('theory')}
            className={`pb-2.5 text-xs font-medium flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'theory'
                ? 'border-[var(--accent)] text-[var(--fg)]'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--fg)]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" /> Academic Operating Systems Guide
          </button>
        </div>

        {/* Tab 1: Banker's Algorithm */}
        {activeTab === 'simulator' && (
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[var(--fg)]">Dijkstra&apos;s Banker&apos;s Safety Algorithm</h3>
                <p className="text-xs text-[var(--muted)]">
                  Verifies whether allocating requested resources leaves the OS in a verified safe state where a deadlock-free sequence exists.
                </p>
              </div>
              <Btn onClick={solveBanker} disabled={bankerLoading}>
                <RefreshCw className={`w-3.5 h-3.5 mr-1 ${bankerLoading ? 'animate-spin' : ''}`} />
                Compute Safe Sequence
              </Btn>
            </div>

            {/* Matrix View */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
              <div className="p-3 rounded border border-[var(--border)] bg-[#101012]">
                <div className="text-[var(--muted)] mb-2 font-bold">Available Vector [A, B, C]</div>
                <div className="text-emerald-400 font-bold text-sm">
                  [{bankerInput.available.join(', ')}]
                </div>
              </div>
              <div className="p-3 rounded border border-[var(--border)] bg-[#101012]">
                <div className="text-[var(--muted)] mb-2 font-bold">Allocation Matrix (5 Processes)</div>
                {bankerInput.allocation.map((row, idx) => (
                  <div key={idx} className="flex justify-between text-[11px] text-[var(--fg)]">
                    <span>P{idx}:</span>
                    <span>[{row.join(', ')}]</span>
                  </div>
                ))}
              </div>
              <div className="p-3 rounded border border-[var(--border)] bg-[#101012]">
                <div className="text-[var(--muted)] mb-2 font-bold">Max Demand Matrix</div>
                {bankerInput.maximum.map((row, idx) => (
                  <div key={idx} className="flex justify-between text-[11px] text-[var(--fg)]">
                    <span>P{idx}:</span>
                    <span>[{row.join(', ')}]</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Banker's Result Display */}
            {bankerResult && (
              <div className={`p-4 rounded border text-xs ${bankerResult.is_safe ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {bankerResult.is_safe ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400" />
                  )}
                  <span className={`font-semibold ${bankerResult.is_safe ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {bankerResult.is_safe ? 'SAFE STATE CONFIRMED' : 'UNSAFE STATE DETECTED'}
                  </span>
                </div>

                {bankerResult.is_safe ? (
                  <div className="space-y-2">
                    <div className="font-mono text-xs text-[var(--fg)]">
                      Safe Execution Sequence:{' '}
                      <span className="text-emerald-400 font-bold">
                        ⟨ {bankerResult.safe_sequence.join(' → ')} ⟩
                      </span>
                    </div>
                    <div className="text-[11px] text-[var(--muted)]">
                      All processes can satisfy their maximum claim sequentially without entering deadlock.
                    </div>
                  </div>
                ) : (
                  <div className="text-rose-400 text-xs">
                    No safe sequence exists. Granting these resources causes deadlock among processes: {bankerResult.deadlocked_processes.join(', ')}.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Linux Bash Source Code */}
        {activeTab === 'code' && (
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--muted)]">Inspect genuine Linux Bash scripts executed on the host:</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setCodeType('create')}
                  className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                    codeType === 'create'
                      ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                      : 'border-[var(--border)] text-[var(--muted)]'
                  }`}
                >
                  deadlock_create.sh
                </button>
                <button
                  onClick={() => setCodeType('prevent')}
                  className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                    codeType === 'prevent'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      : 'border-[var(--border)] text-[var(--muted)]'
                  }`}
                >
                  deadlock_prevent.sh
                </button>
                <button
                  onClick={() => setCodeType('resolve')}
                  className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                    codeType === 'resolve'
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                      : 'border-[var(--border)] text-[var(--muted)]'
                  }`}
                >
                  deadlock_resolve.sh
                </button>
              </div>
            </div>

            <pre className="p-4 rounded bg-[#09090b] border border-[var(--border)] text-xs font-mono text-[var(--fg)] overflow-x-auto leading-relaxed">
              <code>{BASH_CODE_SNIPPETS[codeType]}</code>
            </pre>
          </div>
        )}

        {/* Tab 3: Academic OS Guide for Teacher */}
        {activeTab === 'theory' && (
          <div className="p-5 text-xs text-[var(--fg)] space-y-4 leading-relaxed">
            <h3 className="text-sm font-semibold text-[var(--accent)]">
              Formal Operating Systems Deadlock Theory (For Faculty Presentation)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3.5 rounded border border-[var(--border)] bg-[#101012]">
                <h4 className="font-semibold text-emerald-400 mb-1">1. Deadlock Prevention Strategy</h4>
                <p className="text-[var(--muted)] text-[11px]">
                  Imposes constraints on resource requests so that at least one of Coffman&apos;s four conditions cannot hold.
                  Specifically, <strong>Havender&apos;s Total Order Theorem</strong> assigns an index $F: R \to \mathbb{N}$.
                  Since processes request resources strictly in increasing order, circular dependencies $P_1 \to R_2 \to P_2 \to R_1 \to P_1$
                  are mathematically impossible.
                </p>
              </div>
              <div className="p-3.5 rounded border border-[var(--border)] bg-[#101012]">
                <h4 className="font-semibold text-emerald-400 mb-1">2. Deadlock Avoidance Strategy</h4>
                <p className="text-[var(--muted)] text-[11px]">
                  Allows all 4 Coffman conditions to exist, but dynamically tracks the maximum potential claim of each process
                  via <strong>Dijkstra&apos;s Banker&apos;s Algorithm</strong>. If granting a resource request would lead to an unsafe state,
                  the requesting process is blocked until other processes finish and release resources.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
