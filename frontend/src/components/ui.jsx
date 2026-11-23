import { useState, useMemo } from 'react'
import { LIMITED } from '../hooks/useScan'

const TONE = {
  HIGH: 'r', MEDIUM: 'a', LOW: 'c', NEW: 'r', CHANGED: 'r',
  tmp_exec: 'a', deleted_binary: 'r', FAILED: 'r', KNOWN: 'g',
  ok: 'g', OK: 'g', SUCCESS: 'g', linux: 'c', windows: 'p',
  LISTEN: 'g', ESTABLISHED: 'c'
}

export const Badge = ({ v, tone }) => {
  const t = tone || TONE[v]
  return t ? <span className={'badge ' + t}>{v}</span> : v
}

export const Btn = ({ on, loading, children, className = '', ...p }) => (
  <button className={`btn ${on ? 'on' : ''} ${className}`} disabled={loading || p.disabled} {...p}>
    {loading ? '⏳ ' : ''}{children}
  </button>
)

export const Card = ({ title, children, className = '' }) => (
  <div className={`card ${className}`}>
    {title && <h4>{title}</h4>}
    {children}
  </div>
)

export const Stat = ({ label, value, sub }) => (
  <Card title={label}>
    <div className="stat">{value}</div>
    {sub && <span className="dim">{sub}</span>}
  </Card>
)

export const ErrorBox = ({ error, errors = [] }) => (
  <>
    {error && <p className="err">✖ {error}</p>}
    {errors.map((e, i) => (
      <p key={i} className="err">
        {LIMITED.test(e) && <Badge v="LIMITED MODE" tone="a" />} {e}
      </p>
    ))}
  </>
)

const col = v => v < 50 ? 'var(--g)' : v < 80 ? 'var(--a)' : 'var(--r)'

export const Bar = ({ label, v = 0 }) => (
  <div className="row">
    <span>{label}</span>
    <div className="track">
      <i style={{ width: `${Math.min(Math.max(v, 0), 100)}%`, background: col(v) }} />
    </div>
    <span style={{ minWidth: 42, textAlign: 'right' }}>{v}%</span>
  </div>
)

export function Gauge({ score = 0, size = 220 }) {
  const c = score < 30 ? 'var(--g)' : score < 60 ? 'var(--a)' : 'var(--r)'
  const arc = 'M10 75A60 60 0 0 1 130 75'
  return (
    <svg viewBox="0 0 140 90" width={size}>
      <path d={arc} fill="none" stroke="#223041" strokeWidth="12" />
      <path d={arc} fill="none" stroke={c} strokeWidth="12" strokeDasharray={`${score * 1.885} 200`} />
      <text x="70" y="68" textAnchor="middle" fill={c} fontSize="26" fontWeight="700">{score}</text>
      <text x="70" y="86" textAnchor="middle" fill={c} fontSize="10">{score < 30 ? 'SAFE' : score < 60 ? 'WARNING' : 'CRITICAL'}</text>
    </svg>
  )
}

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
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Table({ rows, cols, onRow, sel, pageSize = 20 }) {
  const [key, setKey] = useState(null), [dir, setDir] = useState(1)
  const [filter, setFilter] = useState(''), [page, setPage] = useState(1)

  const k = useMemo(() => {
    if (cols) return cols
    if (rows && rows.length > 0) return Object.keys(rows[0])
    return []
  }, [cols, rows])

  // Filter
  const filtered = useMemo(() => {
    if (!rows || !rows.length) return []
    if (!filter) return rows
    const q = filter.toLowerCase()
    return rows.filter(r => k.some(colKey => String(r[colKey] ?? '').toLowerCase().includes(q)))
  }, [rows, filter, k])

  // Sort
  const sorted = useMemo(() => {
    if (!key) return filtered
    return [...filtered].sort((a, b) => {
      const va = a[key] ?? '', vb = b[key] ?? ''
      return (isNaN(va) || isNaN(vb) ? String(va).localeCompare(String(vb)) : Number(va) - Number(vb)) * dir
    })
  }, [filtered, key, dir])

  if (!rows?.length) return <p className="dim">No rows.</p>

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const curPage = Math.min(page, totalPages)
  const paginated = sorted.slice((curPage - 1) * pageSize, curPage * pageSize)

  return (
    <div className="table-wrapper">
      {rows.length > 8 && (
        <div className="table-toolbar">
          <input
            className="table-search"
            placeholder="Search rows..."
            value={filter}
            onChange={e => { setFilter(e.target.value); setPage(1) }}
          />
          <div className="table-pagination">
            <span>{sorted.length} items</span>
            {totalPages > 1 && (
              <>
                <button className="btn btn-sm" disabled={curPage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>◀</button>
                <span>{curPage} / {totalPages}</span>
                <button className="btn btn-sm" disabled={curPage >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>▶</button>
              </>
            )}
          </div>
        </div>
      )}
      <div className="scroll">
        <table>
          <thead>
            <tr>
              {k.map(c => (
                <th key={c} onClick={() => { setDir(key === c ? -dir : 1); setKey(c) }}>
                  {c}{key === c ? (dir > 0 ? ' ▲' : ' ▼') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.map((r, i) => (
              <tr key={i} className={(onRow ? 'click ' : '') + (sel?.(r) ? 'sel' : '')} onClick={() => onRow?.(r)}>
                {k.map(c => (
                  <td key={c} title={String(r[c] ?? '')}>
                    <Badge v={r[c]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
