import { useCallback, useEffect, useState } from 'react'
import { api, toCsv } from '../api'
import { Badge, Btn, ErrorBox } from '../components/ui'
const TONE = { alert: 'r', login_failed: 'a', login_ok: 'g', sudo: 'c', su: 'c', baseline_saved: 'p', snapshot: 'c' }
const MODULES = ['', 'auth', 'process', 'network', 'integrity', 'persistence', 'usb', 'system']
export default function Timeline() {
  const [hours, setHours] = useState(24), [mod, setMod] = useState(''), [ev, setEv] = useState([]), [err, setErr] = useState('')
  const load = useCallback(() => api(`/api/timeline?hours=${hours}${mod ? `&module=${mod}` : ''}`).then(d => { setEv(d); setErr('') }).catch(e => setErr(e.message)), [hours, mod])
  useEffect(() => { load() }, [load])
  return <div>{[[1, '1h'], [24, '24h'], [168, '7d']].map(([h, l]) => <Btn key={h} on={hours === h} onClick={() => setHours(h)}>{l}</Btn>)}<br />
    {MODULES.map(m => <Btn key={m} on={mod === m} onClick={() => setMod(m)}>{m || 'ALL'}</Btn>)}<Btn onClick={load}>Refresh</Btn><Btn onClick={() => toCsv(ev, 'timeline.csv')} disabled={!ev.length}>Export CSV</Btn>
    <ErrorBox error={err} /><div className="log">{ev.map((e, i) => <div key={i}><span className="dim">{new Date(e.ts * 1000).toLocaleString()}</span> <Badge v={e.source} /> [{e.module}] <Badge v={e.kind} tone={TONE[e.kind] || 'c'} /> {e.summary}</div>)}
      {!ev.length && <p className="dim">No events in this range. Run scans, save baselines, or check the Auth page.</p>}</div></div>
}
