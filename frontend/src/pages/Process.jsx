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
import { saveBaseline, toCsv, api } from '../api'
import { useScan } from '../hooks/useScan'
import { Badge, Btn, Card } from '../components/ui'
import ProcessTreeGraph from '../components/ProcessTreeGraph'

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

// ── Top component (strictly preserves Vitest contract) ──────────────────────
const topBy = (rows, k, n = 5) =>
  [...rows].sort((a, b) => Number(b[k]) - Number(a[k])).slice(0, n)

export function Top({ rows = [] }) {
  const L = (k, u) =>
    topBy(rows, k).map(r => (
      <div key={r.source + r.pid} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0' }}>
        <Badge v={r.source} />
        <span style={{ fontWeight: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
          {r.name}
        </span>
        <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums', color: k === 'cpu' && Number(r.cpu) > 50 ? 'var(--r)' : 'var(--fg)' }}>
          {k === 'mem' ? Math.round(r.mem / 1024) : r.cpu}{u}
        </span>
      </div>
    ))
  return (
    <div className="grid" style={{ marginBottom: 16 }}>
      <Card title="Top 5 CPU (real, 100 = one core)">{L('cpu', '%')}</Card>
      <Card title="Top 5 RAM">{L('mem', ' MB')}</Card>
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
  const [livePoll, setLivePoll] = useState(true)
  const [killing, setKilling]   = useState(false)
  const [lastScanAt, setLastScanAt] = useState(new Date().toLocaleTimeString())

  const all  = data?.rows || []
  const rows = bad ? all.filter(r => r.flag !== 'ok') : all
  const view = tree ? flat(rows, open) : rows
  const badCount = all.filter(r => r.flag !== 'ok').length

  // Live Auto-Polling Engine (every 4 seconds, bypassing 5s cache)
  useEffect(() => {
    if (!livePoll) return
    const interval = setInterval(() => {
      run(true)
      setLastScanAt(new Date().toLocaleTimeString())
    }, 4000)
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
    if (col === 'cpu')    return (
      <span className="mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: Number(row.cpu) > 40 ? 'var(--r)' : 'inherit', fontWeight: Number(row.cpu) > 40 ? 600 : 400 }}>
        <span>{row.cpu ?? '—'}</span>
        {Number(row.cpu) > 0 && (
          <span style={{ width: 36, height: 4, background: 'var(--line)', borderRadius: 2, display: 'inline-block', overflow: 'hidden' }}>
            <span style={{ display: 'block', height: '100%', width: `${Math.min(100, Number(row.cpu))}%`, background: Number(row.cpu) > 40 ? 'var(--r)' : 'var(--accent)' }} />
          </span>
        )}
      </span>
    )
    if (col === 'pid')    return <span className="mono" style={{ color: 'var(--fg)', fontWeight: 500 }}>{row.pid}</span>

    if (col === 'name') {
      if (tree && row._depth !== undefined) {
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}>
            <span style={{ color: 'var(--dim)', userSelect: 'none' }}>
              {row.name.slice(0, row.name.indexOf(row._rawName))}
            </span>
            <span style={{ fontWeight: row._kids ? 600 : 400, color: 'var(--fg)' }}>
              {row._rawName}
            </span>
            {row._kids > 0 && (
              <span className="badge" style={{ fontSize: 9.5, padding: '1px 5px', marginLeft: 4, color: 'var(--dim)', borderColor: 'var(--line)' }}>
                {row._kids} {row._kids === 1 ? 'child' : 'children'}
              </span>
            )}
          </span>
        )
      }
      return <span>{row.name}</span>
    }

    return <span>{row[col] ?? '—'}</span>
  }

  // 3D Process Hierarchy Deck representation
  const topRoots = all.filter(r => r.ppid === 0 || r.ppid === '0' || !byKey.has(r.source + r.ppid)).slice(0, 16)

  return (
    <div>
      {/* ── Process Monitor Header ── */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 6,
                  background: 'var(--panel-hover)',
                  border: '1px solid var(--line)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--fg)'
                }}
              >
                <Cpu size={18} strokeWidth={1.8} />
              </div>
              <div>
                <h3 style={{ margin: 0, color: 'var(--fg)', fontSize: 16, fontWeight: 600 }}>
                  Process monitor
                </h3>
                <span className="dim" style={{ fontSize: 11 }}>
                  Application hierarchy, resource consumption, and inspection
                </span>
              </div>
              <Badge v={badCount > 0 ? `${badCount} suspicious` : 'Processes normal'} tone={badCount > 0 ? 'r' : 'g'} />
            </div>

            <p className="dim" style={{ fontSize: 12, margin: '6px 0 0', maxWidth: 740, lineHeight: 1.5 }}>
              Monitors active system processes. Inspects execution binaries, CPU/memory usage, and parent process lineage.
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
                gap: 6
              }}
              title="Toggle automatic live process polling every 3.5s"
            >
              <Radio size={13} className={livePoll ? 'spin' : ''} />
              <span>{livePoll ? 'Live stream: on' : 'Live stream: off'}</span>
            </button>

            <span className="dim" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={11} /> Last scan: {lastScanAt}
            </span>
            <span className="dim" style={{ fontSize: 11 }}>
              PIDs: <b>{all.length}</b> ({rows.length} shown)
            </span>
          </div>
        </div>
      </div>

      {/* ── Toolbar & Control Deck ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14, alignItems: 'center' }}>
        <Btn onClick={() => { run(true); setLastScanAt(new Date().toLocaleTimeString()) }} loading={loading}>
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
          <FolderTree size={13} /> Tree View
        </Btn>

        {/* List View Toggle button */}
        <Btn
          on={!tree}
          onClick={() => {
            setTree(false)
          }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <List size={13} /> List View
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
          <ShieldAlert size={13} /> Show Suspicious Only
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
          <Save size={13} /> Save Baseline
        </Btn>

        <Btn
          onClick={() => toCsv(all, 'processes.csv')}
          disabled={!all.length}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <Download size={13} /> Export CSV
        </Btn>

        <span className="dim" style={{ marginLeft: 'auto', fontSize: 12 }}>
          {all.length > 0 && `${rows.length} processes`}
          {msg && <span style={{ color: 'var(--g)', marginLeft: 6 }}>· {msg}</span>}
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

      {/* Main content: table or visual tree + detail panel */}
      {all.length > 0 && (
        <div className="two" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 12, alignItems: 'start' }}>
          {tree ? (
            <ProcessTreeGraph
              rows={rows}
              openSet={open}
              selected={sel}
              onSelect={r => setSel(byKey.get(r.source + r.pid) || r)}
              onToggle={k =>
                setOpen(o => {
                  const n = new Set(o)
                  if (n.has(k)) n.delete(k)
                  else n.add(k)
                  return n
                })
              }
              onExpandAll={() => setOpen(new Set(all.map(r => r.source + r.ppid)))}
              onCollapseAll={() => setOpen(new Set())}
            />
          ) : (
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
          )}

          {/* Detail panel */}
          <Card title="Process Details">
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

                <div style={{ marginTop: 10 }}>
                  <Btn
                    variant="danger"
                    loading={killing}
                    onClick={async () => {
                      setKilling(true)
                      try {
                        await api(`/api/process/${sel.pid}/kill`, 'POST')
                        setMsg(`Terminated ${sel._rawName || sel.name} (PID ${sel.pid})`)
                        setSel(null)
                        await run(true)
                      } catch (ex) {
                        setMsg(ex.message || 'Kill failed')
                      } finally {
                        setKilling(false)
                      }
                    }}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    Terminate Process (PID {sel.pid})
                  </Btn>
                </div>

                {chain(sel).length > 0 && (
                  <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10, marginTop: 10 }}>
                    <p style={{ marginTop: 8, marginBottom: 8, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <b>Parent chain:</b>
                      <span className="dim" style={{ fontSize: 10 }}>{chain(sel).length} ancestor(s)</span>
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {chain(sel).map((p, idx) => (
                        <div
                          key={p.source + p.pid}
                          style={{
                            padding: '4px 8px',
                            background: 'var(--panel-hover)',
                            borderRadius: 4,
                            fontSize: 11,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 6
                          }}
                        >
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden' }}>
                            <span style={{ color: 'var(--dim)', userSelect: 'none' }}>{'↳'.repeat(idx + 1)}</span>
                            <span style={{ color: p.flag !== 'ok' ? 'var(--r)' : 'var(--fg)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            <span className="mono dim" style={{ fontSize: 10 }}>({p.pid})</span>
                            {p.flag !== 'ok' && <FlagBadge v={p.flag} />}
                          </span>
                        </div>
                      ))}
                    </div>
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
