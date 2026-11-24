import { useState, useMemo } from 'react'
import { Loader2, Info, Inbox } from 'lucide-react'
import { LIMITED } from '../hooks/useScan'

// ─── TONE MAP ─────────────────────────────────────────────────────────────────
const TONE = {
  // Risk levels (unified scale)
  SAFE: 'g', LOW: 'y', MEDIUM: 'a', HIGH: 'r', CRITICAL: 'r',
  // Legacy / other statuses
  NEW: 'r', CHANGED: 'r',
  tmp_exec: 'a', deleted_binary: 'r', FAILED: 'r', KNOWN: 'g',
  ok: 'g', OK: 'g', SUCCESS: 'g', linux: 'c', windows: 'p',
  LISTEN: 'g', ESTABLISHED: 'c',
}

// ─── BADGE ────────────────────────────────────────────────────────────────────
export const Badge = ({ v, tone }) => {
  const t = tone || TONE[v]
  if (!t) return <span>{v}</span>
  return (
    <span
      className={'badge ' + t}
      style={{
        display: 'inline-block',
        padding: '2px 6px',
        borderRadius: '4px',
        fontSize: '11px',
        fontWeight: 500,
        lineHeight: '1.4',
        border: 'none',
      }}
    >
      {v}
    </span>
  )
}

// ─── BTN ──────────────────────────────────────────────────────────────────────
export const Btn = ({ variant, on, loading, children, className = '', ...p }) => {
  const activeClass = on ? 'on' : ''
  const variantClass = variant ? `btn-${variant}` : ''
  return (
    <button
      className={`btn ${activeClass} ${variantClass} ${className}`.trim()}
      disabled={loading || p.disabled}
      {...p}
    >
      {loading && <Loader2 size={13} className="spin" style={{ display: 'inline-block' }} />}
      {children}
    </button>
  )
}

// ─── CARD ─────────────────────────────────────────────────────────────────────
export const Card = ({ title, children, className = '', style }) => (
  <div className={`card ${className}`} style={style}>
    {title && <h4>{title}</h4>}
    {children}
  </div>
)

// ─── STAT ─────────────────────────────────────────────────────────────────────
export const Stat = ({ label, value, sub }) => (
  <Card title={label}>
    <div className="stat">{value}</div>
    {sub && <span className="dim">{sub}</span>}
  </Card>
)

// ─── ERROR BOX ────────────────────────────────────────────────────────────────
const WIN_PATTERN = /powershell|not found|winerror|permission|cannot read/i

function isWindowsNoise(msg) {
  return WIN_PATTERN.test(String(msg))
}

export const ErrorBox = ({ error, errors = [] }) => {
  const allErrors = [
    ...(error ? [error] : []),
    ...errors,
  ]

  return (
    <>
      {allErrors.map((e, i) => {
        if (isWindowsNoise(e)) {
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                borderRadius: '8px',
                background: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                color: 'var(--fg)',
                fontSize: '12px',
                marginBottom: '6px',
              }}
            >
              <Info size={15} color="var(--c)" />
              <span>Windows data unavailable on this host.</span>
            </div>
          )
        }
        return (
          <p key={i} className="err" style={{ marginBottom: '4px' }}>
            {LIMITED.test(e) && <Badge v="LIMITED MODE" tone="a" />} {e}
          </p>
        )
      })}
    </>
  )
}

// ─── BAR ──────────────────────────────────────────────────────────────────────
const barColor = v => v < 50 ? 'var(--g, #48bb78)' : v < 80 ? 'var(--a, #ed8936)' : 'var(--r, #e53e3e)'

export const Bar = ({ label, v = 0 }) => {
  const pct = Math.min(Math.max(v, 0), 100)
  return (
    <div
      className="bar-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '6px',
      }}
    >
      <span style={{ minWidth: '100px', fontSize: '12px', color: 'var(--text-secondary)' }}>{label}</span>
      <div
        style={{
          flex: 1,
          height: '4px',
          borderRadius: '2px',
          background: 'var(--line)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: barColor(pct),
            borderRadius: '2px',
            transition: 'width 0.2s ease',
          }}
        />
      </div>
      <span style={{ minWidth: '38px', textAlign: 'right', fontSize: '11px', fontFamily: 'monospace', color: 'var(--fg)' }}>
        {v}%
      </span>
    </div>
  )
}

// ─── GAUGE ────────────────────────────────────────────────────────────────────
function gaugeLabel(score) {
  if (score < 30) return 'SAFE'
  if (score < 50) return 'LOW'
  if (score < 70) return 'MEDIUM'
  if (score < 90) return 'HIGH'
  return 'CRITICAL'
}

function gaugeColor(score) {
  if (score < 30) return '#22c55e'       // green
  if (score < 50) return '#84cc16'       // yellow-green
  if (score < 70) return '#f59e0b'       // amber
  if (score < 90) return '#f97316'       // orange
  return '#ef4444'                        // red
}

export function Gauge({ score = 0, size = 220 }) {
  const c = gaugeColor(score)
  const arc = 'M10 75A60 60 0 0 1 130 75'
  return (
    <svg viewBox="0 0 140 90" width={size}>
      <path d={arc} fill="none" stroke="var(--border, #e5e7eb)" strokeWidth="12" strokeLinecap="round" />
      <path
        d={arc}
        fill="none"
        stroke={c}
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={`${score * 1.885} 200`}
        style={{ transition: 'stroke-dasharray 0.6s ease, stroke 0.4s ease' }}
      />
      <text x="70" y="68" textAnchor="middle" fill={c} fontSize="26" fontWeight="700">{score}</text>
      <text x="70" y="84" textAnchor="middle" fill={c} fontSize="10" fontWeight="600">{gaugeLabel(score)}</text>
    </svg>
  )
}

// ─── MINI SPARKLINE ───────────────────────────────────────────────────────────
export function MiniSparkline({ data = [], color = 'var(--g)', width = 60, height = 16 }) {
  if (!data || data.length < 2) return null
  const max = Math.max(...data, 100), min = 0
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / (max - min)) * height
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={width} height={height} style={{ verticalAlign: 'middle', overflow: 'visible' }}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ─── LOADING SKELETON ─────────────────────────────────────────────────────────
export function LoadingSkeleton({ rows = 5, cols = 4 }) {
  return (
    <div className="skeleton-wrapper" style={{ width: '100%' }}>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        .skeleton-cell {
          height: 14px;
          border-radius: 6px;
          background: linear-gradient(90deg, var(--border, #e5e7eb) 25%, var(--surface-hover, #f3f4f6) 50%, var(--border, #e5e7eb) 75%);
          background-size: 800px 100%;
          animation: shimmer 1.4s infinite linear;
        }
      `}</style>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {Array.from({ length: rows }).map((_, ri) => (
            <tr key={ri} style={{ borderBottom: '1px solid var(--border, #e5e7eb)' }}>
              {Array.from({ length: cols }).map((_, ci) => (
                <td key={ci} style={{ padding: '10px 12px' }}>
                  <div
                    className="skeleton-cell"
                    style={{ width: ci === 0 ? '60%' : ci === cols - 1 ? '40%' : '80%' }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── EMPTY STATE ──────────────────────────────────────────────────────────────
export function EmptyState({ icon, title, message, action, onAction }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        textAlign: 'center',
        gap: '12px',
      }}
    >
      <div style={{ lineHeight: 1 }}>{icon || <Inbox size={36} color="var(--dim)" />}</div>
      {title && (
        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary, #222)' }}>{title}</div>
      )}
      {message && (
        <div style={{ fontSize: '13px', color: 'var(--text-secondary, #888)', maxWidth: '320px' }}>{message}</div>
      )}
      {action && onAction && (
        <Btn variant="secondary" onClick={onAction} style={{ marginTop: '8px' }}>
          {action}
        </Btn>
      )}
    </div>
  )
}

// ─── TABLE ────────────────────────────────────────────────────────────────────
function colKey(col) {
  return typeof col === 'string' ? col : col.key
}

function colLabel(col) {
  if (typeof col === 'object' && col.label) return col.label
  const k = typeof col === 'string' ? col : col.key
  return k.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())
}

function cellContent(col, row) {
  if (typeof col === 'object' && typeof col.render === 'function') {
    return col.render(row[col.key], row)
  }
  const k = colKey(col)
  return <Badge v={row[k]} />
}

export function Table({ rows, cols, onRow, sel, pageSize = 20 }) {
  const [sortKey, setSortKey] = useState(null)
  const [dir, setDir] = useState(1)
  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(1)

  // Derive column keys BEFORE any early returns (hook ordering rules)
  const k = useMemo(() => {
    if (cols) return cols
    if (rows && rows.length > 0) return Object.keys(rows[0])
    return []
  }, [cols, rows])

  // Filter — always called (no early return before hooks)
  const filtered = useMemo(() => {
    if (!rows || !rows.length) return []
    if (!filter) return rows
    const q = filter.toLowerCase()
    return rows.filter(r =>
      k.some(col => String(r[colKey(col)] ?? '').toLowerCase().includes(q))
    )
  }, [rows, filter, k])

  // Sort
  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    return [...filtered].sort((a, b) => {
      const va = a[sortKey] ?? '', vb = b[sortKey] ?? ''
      return (
        isNaN(va) || isNaN(vb)
          ? String(va).localeCompare(String(vb))
          : Number(va) - Number(vb)
      ) * dir
    })
  }, [filtered, sortKey, dir])

  // rows === null/undefined → not loaded yet (early return AFTER all hooks)
  if (rows == null) return null

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const curPage = Math.min(page, totalPages)
  const paginated = sorted.slice((curPage - 1) * pageSize, curPage * pageSize)

  return (
    <div className="table-wrapper">
      {/* Always show toolbar */}
      <div className="table-toolbar" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
        <input
          className="table-search"
          placeholder="Search…"
          value={filter}
          onChange={e => { setFilter(e.target.value); setPage(1) }}
          style={{ flex: 1, maxWidth: '280px' }}
        />
        <div className="table-pagination" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary, #888)' }}>{sorted.length} items</span>
          {totalPages > 1 && (
            <>
              <button
                className="btn btn-sm"
                disabled={curPage <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >◀</button>
              <span style={{ fontSize: '12px' }}>{curPage} / {totalPages}</span>
              <button
                className="btn btn-sm"
                disabled={curPage >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >▶</button>
            </>
          )}
        </div>
      </div>

      {/* rows is [] (loaded but empty) → empty state */}
      {rows.length === 0 ? (
        <EmptyState
          icon={<Inbox size={36} color="var(--dim)" />}
          title="No data"
          message="Nothing to display here yet."
        />
      ) : (
        <div className="scroll">
          <table>
            <thead>
              <tr>
                {k.map(col => {
                  const ck = colKey(col)
                  return (
                    <th
                      key={ck}
                      onClick={() => { setDir(sortKey === ck ? -dir : 1); setSortKey(ck) }}
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                    >
                      {colLabel(col)}{sortKey === ck ? (dir > 0 ? ' ▲' : ' ▼') : ''}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {paginated.map((r, i) => (
                <tr
                  key={i}
                  className={(onRow ? 'click ' : '') + (sel?.(r) ? 'sel' : '')}
                  onClick={() => onRow?.(r)}
                >
                  {k.map(col => {
                    const ck = colKey(col)
                    return (
                      <td key={ck} title={String(r[ck] ?? '')}>
                        {cellContent(col, r)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
