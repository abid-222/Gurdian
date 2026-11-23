import { useState } from 'react'
import { api } from '../api'
import { useScan } from '../hooks/useScan'
import { Badge, Btn, Card, ErrorBox, Table } from '../components/ui'
export default function Generic({ mod, src }) {
  const { data, loading, error, run } = useScan(mod, src), [snaps, setSnaps] = useState(null), [err, setErr] = useState('')
  const history = async () => { try { setSnaps(((await api(`/api/history/${mod}`)).snapshots || []).map(x => ({ ...x, ts: new Date(x.ts * 1000).toLocaleString() }))); setErr('') } catch (e) { setErr(e.message) } }
  return <div><Btn onClick={run} loading={loading}>Scan</Btn>{mod === 'system' && <Btn onClick={history}>Show Snapshots</Btn>}<ErrorBox error={error || err} errors={data?.errors} />
    {data?.alerts.map((a, i) => <div key={i}><Badge v={a.severity} /> {a.message}</div>)}<Table rows={data?.rows} />
    {snaps && <Card title="Saved snapshots (Live Monitor > Snapshot)"><Table rows={snaps} /></Card>}</div>
}
