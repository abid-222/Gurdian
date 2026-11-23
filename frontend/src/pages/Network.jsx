import { useState } from 'react'
import { api, toCsv } from '../api'
import { useScan } from '../hooks/useScan'
import Radar from '../components/Radar'
import { Badge, Btn, Card, ErrorBox, Table } from '../components/ui'
export const perProcess = rows => Object.values(rows.reduce((m, r) => { const k = r.source + (r.process || '-'); m[k] ||= { source: r.source, process: r.process || '-', listening: 0, established: 0 }; m[k][r.state === 'LISTEN' ? 'listening' : 'established']++; return m }, {})).sort((a, b) => b.listening + b.established - a.listening - a.established)
export default function Network({ src }) {
  const { data, loading, error, run } = useScan('network', src), [radar, setRadar] = useState(true), [conn, setConn] = useState(false), [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const all = data?.rows || [], listen = all.filter(r => r.state === 'LISTEN'), est = all.filter(r => r.state === 'ESTABLISHED')
  const save = async () => { setBusy(true); try { const r = await Promise.all((src === 'both' ? ['linux', 'windows'] : [src]).map(s => api(`/api/baseline/network?source=${s}`, 'POST'))); setMsg(`Baseline saved (${r.reduce((a, x) => a + x.saved, 0)} ports)`); run() } catch (e) { setErr(e.message) } setBusy(false) }
  return <div><Btn onClick={run} loading={loading}>Scan Ports</Btn><Btn onClick={save} loading={busy}>Save Baseline</Btn><Btn on={conn} onClick={() => setConn(!conn)}>Show Connections</Btn><Btn on={radar} onClick={() => setRadar(!radar)}>Radar {radar ? 'On' : 'Off'}</Btn><Btn onClick={() => toCsv(all, 'network.csv')} disabled={!all.length}>Export CSV</Btn>
    <span className="dim">{listen.length} listening · {est.length} established {msg}</span><ErrorBox error={error || err} errors={data?.errors} />{data?.alerts.map((a, i) => <div key={i}><Badge v={a.severity} /> {a.message}</div>)}
    <Card title="Connections per process (listening + established)"><Table rows={perProcess(all)} /></Card>
    {radar && <Radar rows={listen} />}<Table rows={conn ? all : listen} cols={['source', 'proto', 'local_addr', 'local_port', 'state', 'process', 'remote_addr', 'status']} /></div>
}
