import { useState } from 'react'
import { Cpu, Info, AlertTriangle } from 'lucide-react'
import { saveBaseline, toCsv } from '../api'
import { useScan } from '../hooks/useScan'
import { Badge, Btn, Card } from '../components/ui'

// ── Tree flattening ─────────────────────────────────────────────────────────
const flat = (rows, open) => {
  const by = {}, ids = new Set(rows.map(r => r.source + r.pid)), seen = new Set(), out = []
  rows.forEach(r => (by[r.source + r.ppid] ||= []).push(r))
  const walk = (r, d) => {
    const k = r.source + r.pid
    if (seen.has(k)) return
    seen.add(k)
    const kids = by[k] || []
    out.push({
      ...r,
      _k: k,
      _kids: kids.length,
      name: '\u00a0\u00a0'.repeat(d) + (kids.length ? (open.has(k) ? '▾ ' : '▸ ') : '· ') + r.name
    })
    if (open.has(k)) kids.forEach(c => walk(c, d + 1))
  }
  rows.filter(r => !ids.has(r.source + r.ppid)).forEach(r => walk(r, 0))
  return out
}

// ── Column definitions ───────────────────────────────────────────────────────
const COLS = [
  { key: 'source',  label: 'Platform' },
  { key: 'pid',     label: 'PID' },
  { key: 'name',    label: 'Process Name' },
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
        <div key={i} style={{
          height: 36,
          margin: '8px 0',
          borderRadius: 6,
          background: 'var(--line, rgba(128,128,128,0.15))',
          opacity: 1 - i * 0.15,
          animation: 'pulse 1.4s ease-in-out infinite'
        }} />
      ))}
      <style>{`@keyframes pulse{0%,100%{opacity:.6}50%{opacity:1}}`}</style>
    </div>
  )
}

// ── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ onScan, loading }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '48px 24px', gap: 16, textAlign: 'center'
    }}>
      <div style={{ opacity: 0.7 }}><Cpu size={48} strokeWidth={1.5} color="var(--c)" /></div>
      <div style={{ fontWeight: 600, fontSize: '1.1em' }}>No process data loaded</div>
      <div className="dim">Click the button below to scan running processes on this host.</div>
      <Btn onClick={onScan} loading={loading}>Scan Processes</Btn>
    </div>
  )
}

// ── Exported Top component ───────────────────────────────────────────────────
export const topBy = (rows, k, n = 5) =>
  [...rows].sort((a, b) => Number(b[k]) - Number(a[k])).slice(0, n)

export function Top({ rows = [] }) {
  const L = (k, u) =>
    topBy(rows, k).map(r => (
      <div key={r.source + r.pid} style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '4px 0' }}>
        <Badge v={r.source} /> <span>{r.name}</span> <b style={{ marginLeft: 'auto' }}>{k === 'mem' ? Math.round(r.mem / 1024) : r.cpu}{u}</b>
      </div>
    ))
  return (
    <div className="grid">
      <Card title="Top 5 CPU (real, 100 = one core)">{L('cpu', '%')}</Card>
      <Card title="Top 5 RAM">{L('mem', ' MB')}</Card>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function Process({ src }) {
  const { data, loading, error, limited, run } = useScan('process', src)
  const [msg, setMsg]   = useState('')
  const [tree, setTree] = useState(false)
  const [bad, setBad]   = useState(false)
  const [open, setOpen] = useState(new Set())
  const [sel, setSel]   = useState(null)

  const all  = data?.rows || []
  const rows = bad ? all.filter(r => r.flag !== 'ok') : all
  const view = tree ? flat(rows, open) : rows
  const badCount = all.filter(r => r.flag !== 'ok').length

  // Build a lookup map for the detail panel
  const byKey = new Map(all.map(r => [r.source + r.pid, r]))
  const chain = r => {
    const c = []
    let p = byKey.get(r.source + r.ppid)
    while (p && c.length < 12) { c.push(p); p = byKey.get(p.source + p.ppid) }
    return c
  }

  const click = r => {
    const k = r.source + r.pid
    if (tree && r._kids) {
      setOpen(o => { const n = new Set(o); n.has(k) ? n.delete(k) : n.add(k); return n })
    }
    setSel(byKey.get(k))
  }

  // Errors that look like Windows-side collection failures
  const winErrors = [error, ...(data?.errors || [])].filter(isWindowsError)
  const otherErrors = [error, ...(data?.errors || [])].filter(e => e && !isWindowsError(e))

  // Render cells with custom formatting
  const renderCell = (col, row) => {
    const displayRow = row
    if (col === 'source') return <PlatformBadge v={displayRow.source} />
    if (col === 'flag')   return <FlagBadge v={displayRow.flag} />
    if (col === 'name')   return <span>{displayRow.name}</span>
    if (col === 'mem')    return <span>{displayRow.mem != null ? Math.round(displayRow.mem / 1024) : '—'}</span>
    if (col === 'cpu')    return <span>{displayRow.cpu ?? '—'}</span>
    if (col === 'pid')    return <span>{displayRow.pid}</span>
    return <span>{displayRow[col] ?? '—'}</span>
  }

  return (
    <div>
      {/* ── 3D Security Module Banner ── */}
      <div className="status-banner-3d">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Cpu size={22} color="var(--c)" />
              <h3 style={{ margin: 0, color: 'var(--fg)', fontSize: 16 }}>
                Active Process Sentinel & Ghost Binary Detection
              </h3>
              <Badge v={badCount > 0 ? `${badCount} SUSPICIOUS` : 'SECURE'} tone={badCount > 0 ? 'r' : 'g'} />
            </div>
            <p className="dim" style={{ fontSize: 13, margin: '4px 0 0', maxWidth: 740, lineHeight: 1.5 }}>
              Continuous inspection of Linux <code style={{ color: 'var(--c)' }}>/proc/[pid]</code> and Windows CIM instances.
              Automatically flags memory-only deleted binaries (<code style={{ color: 'var(--r)' }}>deleted_binary</code>) and rogue executions from world-writable temporary directories (<code style={{ color: 'var(--a)' }}>tmp_exec</code>).
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="badge c" style={{ fontSize: 11, padding: '4px 10px' }}>
              Active PIDs: {all.length}
            </span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <Btn onClick={run} loading={loading}>Scan Processes</Btn>
        <Btn on={tree} onClick={() => { setTree(true); setOpen(new Set(all.map(r => r.source + r.ppid))) }}>Tree View</Btn>
        <Btn on={!tree} onClick={() => setTree(false)}>List View</Btn>
        <Btn on={bad} onClick={() => setBad(!bad)}>Show Suspicious Only</Btn>
        <Btn onClick={async () => {
          const r = await saveBaseline('process', src)
          setMsg(`Baseline saved (${r.reduce((a, x) => a + x.saved, 0)} programs)`)
          run()
        }}>Save Baseline</Btn>
        <Btn onClick={() => toCsv(all, 'processes.csv')} disabled={!all.length}>Export CSV</Btn>
        <span className="dim" style={{ marginLeft: 'auto' }}>
          {all.length > 0 && `${rows.length} processes · read-only`}
          {msg && <> · {msg}</>}
        </span>
      </div>

      {/* Windows info banner */}
      {winErrors.length > 0 && (
        <div style={{
          background: 'rgba(56,189,248,0.08)',
          border: '1px solid rgba(56,189,248,0.25)',
          borderRadius: 8,
          padding: '10px 14px',
          marginBottom: 12,
          color: 'var(--fg)',
          display: 'flex',
          alignItems: 'center',
          gap: 10
        }}>
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
          <Badge v={a.severity} /> {a.message}
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
          <Card title="Details">
            {sel ? (
              <div style={{ fontSize: '0.9em', lineHeight: 1.7 }}>
                <p>
                  <b>{sel.name}</b>&nbsp;
                  <FlagBadge v={sel.flag} />&nbsp;
                  <PlatformBadge v={sel.source} />
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 12px' }}>
                  <span className="dim">PID</span>       <span>{sel.pid}</span>
                  <span className="dim">PPID</span>      <span>{sel.ppid}</span>
                  <span className="dim">User</span>      <span>{sel.user || '—'}</span>
                  <span className="dim">CPU %</span>     <span>{sel.cpu ?? '—'}</span>
                  <span className="dim">Memory</span>    <span>{sel.mem != null ? (Math.round(sel.mem / 1024 / 1024) || Math.round(sel.mem / 1024)) + ' MB' : '—'}</span>
                  <span className="dim">Status</span>    <span>{sel.status || sel.flag || '—'}</span>
                </div>
                <p className="dim" style={{ marginTop: 8, wordBreak: 'break-all' }}>
                  <b>Path:</b> {sel.exe_path || '—'}
                </p>
                {chain(sel).length > 0 && (
                  <>
                    <p style={{ marginTop: 8, marginBottom: 4 }}><b>Parent chain:</b></p>
                    {chain(sel).map(p => (
                      <div key={p.source + p.pid} className="dim" style={{ paddingLeft: 8 }}>
                        ↑ {p.name} <span style={{ opacity: 0.6 }}>({p.pid})</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            ) : (
              <span className="dim">Click a row to see details.</span>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
