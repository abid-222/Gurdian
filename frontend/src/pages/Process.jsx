import { useEffect, useState } from 'react'
import {
  Cpu,
  Info,
  AlertTriangle,
  FolderTree,
  List,
  ShieldAlert,
  Save,
  Download,
  Layers,
  Radio,
  Clock,
  ChevronRight,
  Terminal
} from 'lucide-react'
import { saveBaseline, toCsv } from '../api'
import { useScan } from '../hooks/useScan'
import { Badge, Btn, Card } from '../components/ui'

// ── Tree flattening ─────────────────────────────────────────────────────────
const flat = (rows, open) => {
  const by = {}
  const ids = new Set(rows.map(r => r.source + r.pid))
  const seen = new Set()
  const out = []

  rows.forEach(r => {
    by[r.source + r.ppid] ||= []
    by[r.source + r.ppid].push(r)
  })

  const walk = (r, d) => {
    const k = r.source + r.pid
    if (seen.has(k)) return
    seen.add(k)
    const kids = by[k] || []
    const isOpen = open.has(k)

    out.push({
      ...r,
      _k: k,
      _depth: d,
      _kids: kids.length,
      _open: isOpen,
      // Strictly preserve '▾ ' and '▸ ' in name so Vitest test: seen('▾') passes!
      name: '\u00a0\u00a0'.repeat(d) + (kids.length ? (isOpen ? '▾ ' : '▸ ') : '· ') + r.name,
      _rawName: r.name
    })

    if (isOpen) {
      kids.forEach(c => walk(c, d + 1))
    }
  }

  // Root processes (those whose parent PID is not in current dataset or ppid === 0)
  const roots = rows.filter(r => !ids.has(r.source + r.ppid) || r.ppid === 0 || r.ppid === '0')
  roots.forEach(r => walk(r, 0))

  // Any orphaned loops fallback
  rows.forEach(r => {
    if (!seen.has(r.source + r.pid)) walk(r, 0)
  })

  return out
}

// ── Column definitions ───────────────────────────────────────────────────────
const COLS = [
  { key: 'source',  label: 'Platform' },
  { key: 'pid',     label: 'PID' },
  { key: 'name',    label: 'Process Name & Hierarchy' },
  { key: 'cpu',     label: 'cpu %' },
  { key: 'mem',     label: 'Memory' },
  { key: 'flag',    label: 'Status' },
]

// ── Platform badge ───────────────────────────────────────────────────────────
const PlatformBadge = ({ v }) => {
  if (!v) return null
  const tone = v === 'linux' ? 'c' : v === 'windows' ? 'p' : undefined
  return <span className={`badge ${tone || ''}`}>{v}</span>
}

// ── Flag / Status badge ──────────────────────────────────────────────────────
const FlagBadge = ({ v }) => {
  if (!v) return null
  if (v === 'ok') return <span className="badge g">ok</span>
  if (v === 'tmp_exec') return <span className="badge a">tmp_exec</span>
  if (v === 'deleted_binary') return <span className="badge r">deleted_binary</span>
  return <span className="badge">{v}</span>
}

// ── Windows info banner ──────────────────────────────────────────────────────
const isWindowsError = msg =>
  /powershell|not found|permission/i.test(msg || '')

// ── Loading skeleton ─────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div style={{ padding: '24px 0' }}>
      {[1, 2, 3, 4, 5].map(i => (
        <div
          key={i}
          style={{
            height: 38,
            margin: '8px 0',
            borderRadius: 8,
            background: 'var(--line, rgba(128,128,128,0.15))',
            opacity: 1 - i * 0.15,
            animation: 'pulse 1.4s ease-in-out infinite'
          }}
        />
      ))}
      <style>{`@keyframes pulse{0%,100%{opacity:.6}50%{opacity:1}}`}</style>
    </div>
  )
}

// ── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ onScan, loading }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        gap: 16,
        textAlign: 'center'
      }}
    >
      <div style={{ opacity: 0.7 }}><Cpu size={48} strokeWidth={1.5} color="var(--c)" /></div>
      <div style={{ fontWeight: 600, fontSize: '1.1em' }}>No process data loaded</div>
      <div className="dim">Click the button below to scan running processes on this host.</div>
      <Btn onClick={onScan} loading={loading}>Scan Processes</Btn>
    </div>
  )
}

// ── Exported Top component (strictly preserves Vitest contract) ──────────────
export const topBy = (rows, k, n = 5) =>
  [...rows].sort((a, b) => Number(b[k]) - Number(a[k])).slice(0, n)

export function Top({ rows = [] }) {
  const L = (k, u) =>
    topBy(rows, k).map(r => (
      <div key={r.source + r.pid} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0' }}>
        <Badge v={r.source} />
        <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
          {r.name}
        </span>
        <b style={{ marginLeft: 'auto', color: k === 'cpu' && Number(r.cpu) > 50 ? 'var(--r)' : 'var(--fg)' }}>
          {k === 'mem' ? Math.round(r.mem / 1024) : r.cpu}{u}
        </b>
      </div>
    ))
  return (
    <div className="grid" style={{ marginBottom: 16 }}>
      <Card className="card-3d" title="Top 5 CPU (real, 100 = one core)">{L('cpu', '%')}</Card>
      <Card className="card-3d" title="Top 5 RAM">{L('mem', ' MB')}</Card>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function Process({ src }) {
  const { data, loading, error, limited, run } = useScan('process', src)
  const [msg, setMsg]           = useState('')
  const [tree, setTree]         = useState(false)
  const [viewMode, setViewMode] = useState('table') // 'table' | 'deck3d'
  const [bad, setBad]           = useState(false)
  const [open, setOpen]         = useState(new Set())
  const [sel, setSel]           = useState(null)
  const [livePoll, setLivePoll] = useState(false)
  const [lastScanAt, setLastScanAt] = useState(new Date().toLocaleTimeString())

  const all  = data?.rows || []
  const rows = bad ? all.filter(r => r.flag !== 'ok') : all
  const view = tree ? flat(rows, open) : rows
  const badCount = all.filter(r => r.flag !== 'ok').length

  // Live Auto-Polling Engine (every 3.5 seconds)
  useEffect(() => {
    if (!livePoll) return
    const interval = setInterval(() => {
      run()
      setLastScanAt(new Date().toLocaleTimeString())
    }, 3500)
    return () => clearInterval(interval)
  }, [livePoll, run])

  // Build a lookup map for detail panel & chain
  const byKey = new Map(all.map(r => [r.source + r.pid, r]))
  const chain = r => {
    const c = []
    let p = byKey.get(r.source + r.ppid)
    while (p && c.length < 12) {
      c.push(p)
      p = byKey.get(p.source + p.ppid)
    }
    return c
  }

  const click = r => {
    const k = r.source + r.pid
    if (tree && r._kids) {
      setOpen(o => {
        const n = new Set(o)
        if (n.has(k)) n.delete(k)
        else n.add(k)
        return n
      })
    }
    setSel(byKey.get(k) || r)
  }

  // Windows-side collection failures
  const winErrors = [error, ...(data?.errors || [])].filter(isWindowsError)
  const otherErrors = [error, ...(data?.errors || [])].filter(e => e && !isWindowsError(e))

  // Render cells with custom formatting & 3D tree branching
  const renderCell = (col, row) => {
    if (col === 'source') return <PlatformBadge v={row.source} />
    if (col === 'flag')   return <FlagBadge v={row.flag} />
    if (col === 'mem')    return <span className="mono">{row.mem != null ? Math.round(row.mem / 1024) : '—'}</span>
    if (col === 'cpu')    return <span className="mono" style={{ color: Number(row.cpu) > 40 ? 'var(--r)' : 'inherit', fontWeight: Number(row.cpu) > 40 ? 700 : 400 }}>{row.cpu ?? '—'}</span>
    if (col === 'pid')    return <span className="mono" style={{ color: 'var(--c)', fontWeight: 600 }}>{row.pid}</span>

    if (col === 'name') {
      return <span>{row.name}</span>
    }

    return <span>{row[col] ?? '—'}</span>
  }

  // 3D Process Hierarchy Deck representation
  const topRoots = all.filter(r => r.ppid === 0 || r.ppid === '0' || !byKey.has(r.source + r.ppid)).slice(0, 16)

  return (
    <div>
      {/* ── 3D Security Module Banner ── */}
      <div className="status-banner-3d">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(56,189,248,0.2) 100%)',
                  border: '1px solid rgba(99,102,241,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--c)',
                  boxShadow: '0 0 14px rgba(99,102,241,0.2)'
                }}
              >
                <Cpu size={22} strokeWidth={2.2} />
              </div>
              <div>
                <h3 style={{ margin: 0, color: 'var(--fg)', fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em' }}>
                  Live Process Sentinel & 3D Execution Hierarchy
                </h3>
                <span className="dim" style={{ fontSize: 11 }}>
                  Real-time parent-child lineage tree, memory dump validation, and anomaly tracking
                </span>
              </div>
              <Badge v={badCount > 0 ? `${badCount} THREATS` : 'ALL SECURE'} tone={badCount > 0 ? 'r' : 'g'} />
            </div>

            <p className="dim" style={{ fontSize: 12.5, margin: '6px 0 0', maxWidth: 740, lineHeight: 1.5 }}>
              Continuous inspection of operating system process tables (<code style={{ color: 'var(--c)' }}>/proc/[pid]</code> and Windows CIM instances).
              Instantly flags memory-resident deleted binaries (<code style={{ color: 'var(--r)' }}>deleted_binary</code>) and rogue executions from world-writable temporary directories (<code style={{ color: 'var(--a)' }}>tmp_exec</code>).
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            {/* Live Polling Switch */}
            <button
              className={`btn btn-sm ${livePoll ? 'on' : ''}`}
              onClick={() => setLivePoll(!livePoll)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: livePoll ? 'rgba(16,185,129,0.18)' : 'rgba(255,255,255,0.05)',
                borderColor: livePoll ? 'var(--g)' : 'var(--line)',
                color: livePoll ? 'var(--g)' : 'var(--fg)',
                fontWeight: 600
              }}
              title="Toggle automatic live process polling every 3.5s"
            >
              <Radio size={13} className={livePoll ? 'spin' : ''} />
              <span>{livePoll ? 'Live Streaming: ON' : 'Live Stream: OFF'}</span>
            </button>

            <span className="dim" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={11} /> Last Scanned: {lastScanAt}
            </span>
            <span className="dim" style={{ fontSize: 11 }}>
              Active PIDs: <b>{all.length}</b> ({rows.length} displayed)
            </span>
          </div>
        </div>
      </div>

      {/* ── Toolbar & Control Deck ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14, alignItems: 'center' }}>
        <Btn onClick={() => { run(); setLastScanAt(new Date().toLocaleTimeString()) }} loading={loading}>
          Scan Processes
        </Btn>

        {/* Tree View Toggle button (strictly preserves Vitest contract: 'Tree View') */}
        <Btn
          on={tree}
          onClick={() => {
            setTree(true)
            setOpen(new Set(all.map(r => r.source + r.ppid)))
          }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <FolderTree size={14} /> Tree View
        </Btn>

        {/* List View Toggle button */}
        <Btn
          on={!tree && viewMode === 'table'}
          onClick={() => {
            setTree(false)
            setViewMode('table')
          }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <List size={14} /> List View
        </Btn>

        {/* 3D Visual Deck View */}
        <Btn
          on={viewMode === 'deck3d'}
          onClick={() => setViewMode(viewMode === 'deck3d' ? 'table' : 'deck3d')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          title="Toggle 3D Process Tree Hierarchy Explorer Deck"
        >
          <Layers size={14} /> 3D Tree Explorer
        </Btn>

        {/* Show Suspicious Only button */}
        <Btn
          on={bad}
          onClick={() => setBad(!bad)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            borderColor: bad ? 'var(--r)' : undefined,
            color: bad ? 'var(--r)' : undefined
          }}
        >
          <ShieldAlert size={14} /> Show Suspicious Only
        </Btn>

        {/* Save Baseline button */}
        <Btn
          onClick={async () => {
            const r = await saveBaseline('process', src)
            const count = r.reduce((a, x) => a + (x.saved || 0), 0)
            setMsg(`Baseline saved (${count} programs)`)
            run()
          }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <Save size={14} /> Save Baseline
        </Btn>

        <Btn
          onClick={() => toCsv(all, 'processes.csv')}
          disabled={!all.length}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <Download size={14} /> Export CSV
        </Btn>

        <span className="dim" style={{ marginLeft: 'auto', fontSize: 12 }}>
          {all.length > 0 && `${rows.length} processes · read-only safe`}
          {msg && <b style={{ color: 'var(--g)', marginLeft: 6 }}>· {msg}</b>}
        </span>
      </div>

      {/* Windows info banner */}
      {winErrors.length > 0 && (
        <div
          style={{
            background: 'rgba(56,189,248,0.08)',
            border: '1px solid rgba(56,189,248,0.25)',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 12,
            color: 'var(--fg)',
            display: 'flex',
            alignItems: 'center',
            gap: 10
          }}
        >
          <Info size={16} color="var(--c)" />
          <span style={{ fontSize: 12 }}>Windows collector unavailable on this host. Showing Linux data only.</span>
        </div>
      )}

      {/* Other errors */}
      {otherErrors.map((e, i) => e && (
        <p key={i} className="err" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={14} /> {e}
        </p>
      ))}

      {limited && <p className="dim">Showing partial data (limited mode).</p>}

      {/* Per-scan alerts */}
      {data?.alerts?.map((a, i) => (
        <div key={i} style={{ marginBottom: 4 }}>
          <Badge v={a.severity} tone={a.severity === 'HIGH' || a.severity === 'CRITICAL' ? 'r' : 'y'} /> {a.message}
        </div>
      ))}

      {/* Loading skeleton */}
      {loading && !data && <Skeleton />}

      {/* Empty state */}
      {!loading && !data && !error && (
        <Card>
          <EmptyState onScan={run} loading={loading} />
        </Card>
      )}

      {/* Empty state after scan returned nothing */}
      {!loading && data && all.length === 0 && (
        <Card>
          <EmptyState onScan={run} loading={loading} />
        </Card>
      )}

      {/* Top CPU and RAM */}
      {all.length > 0 && <Top rows={all} />}

      {/* ── 3D Process Tree Visualizer Mode (Deck View) ── */}
      {viewMode === 'deck3d' && all.length > 0 && (
        <Card
          className="card-3d"
          style={{ marginBottom: 16 }}
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Layers size={16} color="var(--c)" />
                <span>3D Process Hierarchy Tree Visualizer</span>
              </span>
              <span className="dim" style={{ fontSize: 11, fontWeight: 400 }}>
                Click node to focus parent chain
              </span>
            </div>
          }
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, maxHeight: 420, overflowY: 'auto', padding: 4 }}>
            {topRoots.map(root => {
              const rootKey = root.source + root.pid
              const kids = all.filter(r => r.source === root.source && (r.ppid === root.pid || String(r.ppid) === String(root.pid)))
              const isSuspect = root.flag !== 'ok'

              return (
                <div
                  key={rootKey}
                  onClick={() => click(root)}
                  style={{
                    background: isSuspect ? 'rgba(244,63,94,0.08)' : 'var(--panel-2, rgba(255,255,255,0.02))',
                    border: `1px solid ${isSuspect ? 'rgba(244,63,94,0.35)' : 'var(--line)'}`,
                    borderRadius: 10,
                    padding: 12,
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.06)',
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: isSuspect ? 'var(--r)' : 'var(--fg)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Terminal size={14} color="var(--c)" />
                      <span>{root.name}</span>
                    </span>
                    <Badge v={`PID ${root.pid}`} tone="c" />
                  </div>

                  <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--dim)', marginBottom: 8 }}>
                    <span>CPU: <b>{root.cpu ?? '0'}%</b></span>
                    <span>MEM: <b>{root.mem ? Math.round(root.mem / 1024) + 'MB' : '—'}</b></span>
                    <PlatformBadge v={root.source} />
                  </div>

                  {/* Child nodes */}
                  {kids.length > 0 && (
                    <div style={{ borderTop: '1px solid var(--line)', paddingTop: 8, marginTop: 4 }}>
                      <div className="dim" style={{ fontSize: 10, textTransform: 'uppercase', marginBottom: 4 }}>
                        Sub-processes ({kids.length}):
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {kids.slice(0, 4).map(k => (
                          <div
                            key={k.source + k.pid}
                            style={{
                              fontSize: 11,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              background: 'rgba(0,0,0,0.2)',
                              padding: '2px 6px',
                              borderRadius: 4
                            }}
                          >
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <ChevronRight size={10} color="var(--c)" />
                              <span>{k.name}</span>
                            </span>
                            <span className="dim mono" style={{ fontSize: 10 }}>PID {k.pid}</span>
                          </div>
                        ))}
                        {kids.length > 4 && (
                          <span className="dim" style={{ fontSize: 10, paddingLeft: 6 }}>
                            +{kids.length - 4} more children...
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Main content: table + detail panel */}
      {all.length > 0 && (
        <div className="two" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 12, alignItems: 'start' }}>
          {/* Custom table with friendly columns */}
          <div className="table-wrapper">
            <div className="scroll">
              <table>
                <thead>
                  <tr>
                    {COLS.map(c => <th key={c.key}>{c.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {view.map((r, i) => (
                    <tr
                      key={i}
                      className={'click ' + (sel && r.source + r.pid === sel.source + sel.pid ? 'sel' : '')}
                      onClick={() => click(r)}
                    >
                      {COLS.map(c => (
                        <td key={c.key}>{renderCell(c.key, r)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detail panel */}
          <Card className="card-3d" title="Process Details">
            {sel ? (
              <div style={{ fontSize: '0.9em', lineHeight: 1.7 }}>
                <p style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', margin: '0 0 10px' }}>
                  <b style={{ fontSize: 14, color: 'var(--fg)' }}>{sel._rawName || sel.name}</b>
                  <FlagBadge v={sel.flag} />
                  <PlatformBadge v={sel.source} />
                </p>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr',
                    gap: '4px 12px',
                    background: 'var(--panel-2, rgba(255,255,255,0.02))',
                    padding: 10,
                    borderRadius: 8,
                    border: '1px solid var(--line)'
                  }}
                >
                  <span className="dim">PID</span>       <span className="mono">{sel.pid}</span>
                  <span className="dim">PPID</span>      <span className="mono">{sel.ppid}</span>
                  <span className="dim">User</span>      <span>{sel.user || '—'}</span>
                  <span className="dim">CPU %</span>     <span className="mono">{sel.cpu ?? '—'}</span>
                  <span className="dim">Memory</span>    <span className="mono">{sel.mem != null ? (Math.round(sel.mem / 1024 / 1024) || Math.round(sel.mem / 1024)) + ' MB' : '—'}</span>
                  <span className="dim">Status</span>    <span>{sel.status || sel.flag || '—'}</span>
                </div>

                <p className="dim" style={{ marginTop: 10, wordBreak: 'break-all', fontSize: 11.5 }}>
                  <b>Executable Path:</b> <code className="mono">{sel.exe_path || '—'}</code>
                </p>

                {chain(sel).length > 0 && (
                  <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10, marginTop: 10 }}>
                    <p style={{ marginTop: 8, marginBottom: 4 }}>
                      <b>Parent chain:</b>
                    </p>
                    {chain(sel).map((p, idx) => (
                      <div
                        key={p.source + p.pid}
                        className="dim"
                        style={{
                          paddingLeft: idx * 8 + 6,
                          fontSize: 11,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          lineHeight: 1.8
                        }}
                      >
                        <span style={{ color: 'var(--c)' }}>↑</span>
                        <span style={{ color: 'var(--fg)', fontWeight: 500 }}>{p.name}</span>
                        <span className="mono" style={{ opacity: 0.6 }}>({p.pid})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <span className="dim">Click a process row or tree node to view details.</span>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
