import { useState } from 'react'
import { LIMITED } from '../hooks/useScan'
const TONE = { HIGH: 'r', MEDIUM: 'a', LOW: 'c', NEW: 'r', CHANGED: 'r', tmp_exec: 'a', deleted_binary: 'r', FAILED: 'r', KNOWN: 'g', ok: 'g', OK: 'g', SUCCESS: 'g', linux: 'c', windows: 'p', LISTEN: 'g', ESTABLISHED: 'c' }
export const Badge = ({ v, tone }) => { const t = tone || TONE[v]; return t ? <span className={'badge ' + t}>{v}</span> : v }
export const Btn = ({ on, loading, children, ...p }) => <button className={'btn' + (on ? ' on' : '')} {...p} disabled={loading || p.disabled}>{loading ? '⏳ ' : ''}{children}</button>
export const Card = ({ title, children }) => <div className="card">{title && <h4>{title}</h4>}{children}</div>
export const Stat = ({ label, value, sub }) => <Card title={label}><div className="stat">{value}</div><span className="dim">{sub}</span></Card>
export const ErrorBox = ({ error, errors = [] }) => <>{error && <p className="err">✖ {error}</p>}{errors.map((e, i) => <p key={i} className="err">{LIMITED.test(e) && <Badge v="LIMITED MODE" tone="a" />} {e}</p>)}</>
const col = v => v < 50 ? 'var(--g)' : v < 80 ? 'var(--a)' : 'var(--r)'
export const Bar = ({ label, v = 0 }) => <div className="row"><span>{label}</span><div className="track"><i style={{ width: `${Math.min(v, 100)}%`, background: col(v) }} /></div><span>{v}%</span></div>
export function Gauge({ score = 0 }) {
  const c = score < 30 ? 'var(--g)' : score < 60 ? 'var(--a)' : 'var(--r)', arc = 'M10 75A60 60 0 0 1 130 75'
  return <svg viewBox="0 0 140 90" width="220"><path d={arc} fill="none" stroke="#223041" strokeWidth="12" /><path d={arc} fill="none" stroke={c} strokeWidth="12" strokeDasharray={`${score * 1.885} 200`} />
    <text x="70" y="68" textAnchor="middle" fill={c} fontSize="26" fontWeight="700">{score}</text><text x="70" y="86" textAnchor="middle" fill={c} fontSize="10">{score < 30 ? 'SAFE' : score < 60 ? 'WARNING' : 'CRITICAL'}</text></svg>
}
export function Table({ rows, cols, onRow, sel }) {
  const [key, setKey] = useState(null), [dir, setDir] = useState(1)
  if (!rows?.length) return <p className="dim">No rows.</p>
  const k = cols || Object.keys(rows[0]), data = key ? [...rows].sort((a, b) => (isNaN(a[key]) ? String(a[key]).localeCompare(b[key]) : a[key] - b[key]) * dir) : rows
  return <div className="scroll"><table><thead><tr>{k.map(c => <th key={c} onClick={() => { setDir(key === c ? -dir : 1); setKey(c) }}>{c}{key === c ? (dir > 0 ? ' ▲' : ' ▼') : ''}</th>)}</tr></thead>
    <tbody>{data.map((r, i) => <tr key={i} className={(onRow ? 'click ' : '') + (sel?.(r) ? 'sel' : '')} onClick={() => onRow?.(r)}>{k.map(c => <td key={c} title={r[c]}><Badge v={r[c]} /></td>)}</tr>)}</tbody></table></div>
}
