import { useState } from 'react'
import { saveBaseline, toCsv } from '../api'
import { useScan } from '../hooks/useScan'
import { Badge, Btn, Card, ErrorBox, Table } from '../components/ui'
const flat = (rows, open) => {   // tree built from ppid, expand / collapse
  const by = {}, ids = new Set(rows.map(r => r.source + r.pid)), seen = new Set(), out = []
  rows.forEach(r => (by[r.source + r.ppid] ||= []).push(r))
  const walk = (r, d) => { const k = r.source + r.pid; if (seen.has(k)) return; seen.add(k); const kids = by[k] || []
    out.push({ ...r, _k: k, _kids: kids.length, name: '\u00a0\u00a0'.repeat(d) + (kids.length ? (open.has(k) ? '▾ ' : '▸ ') : '· ') + r.name }); if (open.has(k)) kids.forEach(c => walk(c, d + 1)) }
  rows.filter(r => !ids.has(r.source + r.ppid)).forEach(r => walk(r, 0)); return out
}
export const topBy = (rows, k, n = 5) => [...rows].sort((a, b) => Number(b[k]) - Number(a[k])).slice(0, n)
export function Top({ rows }) {
  const L = (k, u) => topBy(rows, k).map(r => <div key={r.source + r.pid}><Badge v={r.source} /> {r.name} <b>{k === 'mem' ? Math.round(r.mem / 1024) : r.cpu}{u}</b></div>)
  return <div className="grid"><Card title="Top 5 CPU (real, 100 = one core)">{L('cpu', '%')}</Card><Card title="Top 5 RAM">{L('mem', ' MB')}</Card></div>
}
export default function Process({ src }) {
  const { data, loading, error, limited, run } = useScan('process', src)
  const [msg, setMsg] = useState(''), [tree, setTree] = useState(false), [bad, setBad] = useState(false), [open, setOpen] = useState(new Set()), [sel, setSel] = useState(null)
  const all = data?.rows || [], rows = bad ? all.filter(r => r.flag !== 'ok') : all, view = tree ? flat(rows, open) : rows
  const byKey = new Map(all.map(r => [r.source + r.pid, r])), chain = r => { const c = []; let p = byKey.get(r.source + r.ppid); while (p && c.length < 12) { c.push(p); p = byKey.get(p.source + p.ppid) } return c }
  const click = r => { const k = r.source + r.pid; if (tree && r._kids) setOpen(o => { const n = new Set(o); n.has(k) ? n.delete(k) : n.add(k); return n }); setSel(byKey.get(k)) }
  return <div><Btn onClick={run} loading={loading}>Scan Processes</Btn><Btn on={tree} onClick={() => { setTree(true); setOpen(new Set(all.map(r => r.source + r.ppid))) }}>Tree View</Btn><Btn on={!tree} onClick={() => setTree(false)}>List View</Btn>
    <Btn on={bad} onClick={() => setBad(!bad)}>Show Suspicious Only</Btn><Btn onClick={async () => { const r = await saveBaseline('process', src); setMsg(`Baseline saved (${r.reduce((a, x) => a + x.saved, 0)} programs)`); run() }}>Save Baseline</Btn><Btn onClick={() => toCsv(all, 'processes.csv')} disabled={!all.length}>Export CSV</Btn><span className="dim">{rows.length} processes · read-only (no kill) {msg}</span>
    <ErrorBox error={error} errors={data?.errors} />{limited && <p className="dim">Showing partial data.</p>}
    {data?.alerts.map((a, i) => <div key={i}><Badge v={a.severity} /> {a.message}</div>)}
    <Top rows={all} />
    <div className="two"><Table rows={view} cols={['source', 'pid', 'ppid', 'name', 'exe_path', 'cpu', 'mem', 'flag', 'status']} onRow={click} sel={r => sel && r.source + r.pid === sel.source + sel.pid} />
      <Card title="Details">{sel ? <div><p><b>{sel.name}</b> <Badge v={sel.flag} /> <Badge v={sel.source} /></p><p>pid {sel.pid} · ppid {sel.ppid} · user {sel.user}</p><p className="dim">path: {sel.exe_path}</p><p>parent chain:</p>{chain(sel).map(p => <div key={p.pid} className="dim">↑ {p.name} ({p.pid})</div>)}</div> : <span className="dim">Click a row.</span>}</Card></div></div>
}
