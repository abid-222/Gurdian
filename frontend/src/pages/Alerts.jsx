import { useCallback, useEffect, useState } from 'react'
import { api, toCsv } from '../api'
import { Badge, Btn, Card, ErrorBox } from '../components/ui'
export default function Alerts({ bump }) {
  const [al, setAl] = useState([]), [f, setF] = useState(''), [sel, setSel] = useState(null), [err, setErr] = useState('')
  const load = useCallback(() => api('/api/alerts' + (f ? `?severity=${f}` : '')).then(setAl).catch(e => setErr(e.message)), [f])
  useEffect(() => { load() }, [load])
  return <div>{['', 'HIGH', 'MEDIUM', 'LOW'].map(s => <Btn key={s} on={f === s} onClick={() => setF(s)}>{s || 'ALL'}</Btn>)}<Btn onClick={() => toCsv(al, 'alerts.csv')} disabled={!al.length}>Export</Btn><ErrorBox error={err} />
    <div className="two"><div className="log">{al.map(a => <div key={a.id} style={{ opacity: a.acknowledged ? .4 : 1 }} onClick={() => setSel(a)}>
      <span className="dim">{new Date(a.ts * 1000).toLocaleTimeString()}</span> [{a.module}] <Badge v={a.severity} /> {a.message} <Badge v={a.source} />
      {!a.acknowledged && <Btn onClick={e => { e.stopPropagation(); api(`/api/alerts/${a.id}/ack`, 'POST').then(() => { load(); bump() }) }}>Acknowledge</Btn>}</div>)}{!al.length && <p className="dim">No alerts.</p>}</div>
      <Card title="Raw evidence">{sel ? <div className="drawer"><b>{sel.rule_id}</b> +{sel.points} {sel.reference && `(${sel.reference})`}{'\n\n'}{sel.evidence}</div> : <span className="dim">Click an alert.</span>}</Card></div></div>
}
