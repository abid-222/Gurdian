import { useState } from 'react'
import { api } from '../api'
import { useScan } from '../hooks/useScan'
import { Badge, Btn, Card, ErrorBox, Table } from '../components/ui'
export default function Usb({ src }) {
  const { data, loading, error, run } = useScan('usb', src), [hist, setHist] = useState(null), [err, setErr] = useState('')
  const guard = f => async () => { try { await f() } catch (e) { setErr(e.message) } }
  return <div><Btn onClick={run} loading={loading}>Scan USB</Btn><Btn onClick={guard(async () => setHist((await api('/api/history/usb')).items.map(i => ({ ...i, first_seen: new Date(i.first_seen * 1000).toLocaleString(), last_seen: new Date(i.last_seen * 1000).toLocaleString() }))))}>Show History</Btn>
    <Btn onClick={guard(async () => { await Promise.all((src === 'both' ? ['linux', 'windows'] : [src]).map(s => api(`/api/baseline/usb?source=${s}`, 'POST'))); run() })}>Save Baseline</Btn>
    <ErrorBox error={error || err} errors={data?.errors} />{data?.alerts.map((a, i) => <div key={i}><Badge v={a.severity} /> {a.message}</div>)}
    {src === 'linux' && data && !data.rows.length && <p className="dim">WSL2 cannot see USB devices without usbipd (normal). Switch the source to windows or both.</p>}<Table rows={data?.rows} cols={['source', 'name', 'vendor_id', 'product_id', 'serial', 'first_seen', 'status']} />{hist && <Card title="USB history"><Table rows={hist} /></Card>}</div>
}
