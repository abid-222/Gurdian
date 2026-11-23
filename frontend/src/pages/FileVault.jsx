import { useState } from 'react'
import { api, toCsv } from '../api'
import { useScan } from '../hooks/useScan'
import { Badge, Btn, Card, ErrorBox, Table } from '../components/ui'
export default function FileVault({ src }) {
  const { data, loading, error, run } = useScan('integrity', src), [full, setFull] = useState(false), [path, setPath] = useState(''), [msg, setMsg] = useState(''), [err, setErr] = useState('')
  const h = x => x ? (full ? x : x.slice(0, 12) + '…') : '-'
  const rows = (data?.rows || []).map(r => ({ source: r.source, path: r.path, status: r.status || 'NO BASELINE', hash: h(r.sha256), baseline: h(r.baseline_sha256) })), changed = (data?.rows || []).filter(r => r.status === 'CHANGED')
  const act = async (f, ok) => { try { await f(); setMsg(ok); setErr(''); run() } catch (e) { setErr(e.message) } }
  return <div><Btn onClick={run} loading={loading}>Verify Files</Btn><Btn onClick={() => act(() => Promise.all((src === 'both' ? ['linux', 'windows'] : [src]).map(s => api(`/api/baseline/integrity?source=${s}`, 'POST'))), 'Baseline saved')}>Save Baseline</Btn>
    <Btn on={full} onClick={() => setFull(!full)}>Show Hash</Btn><Btn onClick={() => toCsv(data?.rows, 'files.csv')} disabled={!data?.rows.length}>Export</Btn><br />
    <input className="in" placeholder="/absolute/path/to/file" value={path} onChange={e => setPath(e.target.value)} /><Btn onClick={() => act(() => api('/api/watch', 'POST', { path }), `Watching ${path}`)} disabled={!path}>Add File to Watch</Btn><span className="dim">{msg}</span>
    <ErrorBox error={error || err} errors={data?.errors} /><Table rows={rows} />
    {changed.map(r => <Card key={r.path} title={`CHANGED: ${r.path}`}><div>old <code>{r.baseline_sha256}</code></div><div>new <code style={{ color: 'var(--r)' }}>{r.sha256}</code> <Badge v="HIGH" /></div></Card>)}</div>
}
