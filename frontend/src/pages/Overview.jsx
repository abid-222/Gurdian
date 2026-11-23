import { useCallback, useEffect, useState } from 'react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../api'
import { useLive } from '../hooks/useLive'
import { Badge, Btn, Card, ErrorBox, Gauge, Stat } from '../components/ui'
const BOOT = ['Mounting data sources (linux /proc, windows interop)', 'Starting guardian-api.service', 'Loading risk engine', 'Dashboard ready']
export default function Overview({ src, bump }) {
  const [score, setScore] = useState(0), [al, setAl] = useState([]), [info, setInfo] = useState(null), [hist, setHist] = useState([]), [prog, setProg] = useState(null), [err, setErr] = useState(''), [loading, setLoading] = useState(false), [at, setAt] = useState('-')
  const { last, status } = useLive(src)
  const fetchAll = useCallback(() => Promise.all([api('/api/score'), api('/api/alerts'), api('/api/info'), api('/api/score/history?hours=24')]), [])
  const apply = useCallback(([s, a, i, h]) => { setScore(s.score); setAl(a); setInfo(i); setHist(h.map(x => ({ t: new Date(x.ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), score: x.score }))); setErr(''); bump() }, [bump])
  const load = async () => { setLoading(true); try { apply(await fetchAll()) } catch (e) { setErr(e.message) } setLoading(false) }
  useEffect(() => { let on = true; fetchAll().then(d => on && apply(d)).catch(e => on && setErr(e.message)); return () => { on = false } }, [fetchAll, apply])
  const full = async () => {
    const mods = ['process', 'network', 'integrity', 'persistence', 'usb', 'auth']
    for (let i = 0; i < mods.length; i++) { setProg(i); await Promise.all((src === 'both' ? ['linux', 'windows'] : [src]).map(s => api(`/api/scan/${mods[i]}?source=${s}`, 'POST').catch(() => {}))) }
    setProg(null); setAt(new Date().toLocaleTimeString()); load()
  }
  return <div><ErrorBox error={err} />
    <Card>{BOOT.map((l, i) => <div key={i}><span style={{ color: 'var(--g)' }}>[  OK  ]</span> {l}</div>)}</Card>
    <Btn onClick={full} loading={prog !== null}>{prog === null ? 'Run Full Scan' : `Scanning ${prog + 1}/6...`}</Btn><Btn onClick={load} loading={loading}>Refresh</Btn>
    <a href="/api/report?fmt=html" download><Btn>Export Report</Btn></a><span className="dim">last full scan: {at} · live: {status}</span>
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}><Card title="Risk score"><Gauge score={score} /></Card>
      {info && <pre className="card" style={{ color: 'var(--c)', flex: 1 }}>{`OS      ${info.os}\nKernel  ${info.kernel}\nHost    ${info.host}\nUptime  ${Math.floor(info.uptime_s / 60)} min\nCPU     ${info.cpus} cores\nMemory  ${info.mem_mb} MB`}</pre>}</div>
    <Card title="Risk score history (24 h)">{hist.length ? <ResponsiveContainer width="100%" height={140}><LineChart data={hist}><XAxis dataKey="t" stroke="#6e7f91" /><YAxis domain={[0, 100]} stroke="#6e7f91" /><Tooltip contentStyle={{ background: '#111821' }} /><Line type="stepAfter" dataKey="score" stroke="#f85149" dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer> : <span className="dim">No score changes recorded yet. Run a scan.</span>}</Card>
    <div className="grid"><Stat label="CPU" value={last ? `${last.cpu}%` : '-'} sub={src} /><Stat label="RAM" value={last ? `${last.ram}%` : '-'} sub={last ? `disk ${last.disk}%` : ''} />
      <Stat label="Network" value={last?.rx !== undefined ? `${last.rx} KB/s` : '-'} sub={last?.tx !== undefined ? `tx ${last.tx} KB/s` : 'rx/tx: Linux source'} /><Stat label="Open alerts" value={al.filter(a => !a.acknowledged).length} sub="unacknowledged" /></div>
    <Card title="Last 5 alerts">{al.slice(0, 5).map(a => <div key={a.id}><Badge v={a.severity} /> [{a.module}/{a.source}] {a.message}</div>)}{!al.length && <span className="dim">No alerts. Run a scan.</span>}</Card></div>
}
