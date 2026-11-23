import { useEffect, useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../api'
import { useLive } from '../hooks/useLive'
import { Bar, Btn, Card, ErrorBox } from '../components/ui'
import { Top } from './Process'
const Chart = ({ data, keys, unit }) => <ResponsiveContainer width="100%" height={170}><LineChart data={data}><CartesianGrid stroke="#223041" /><XAxis hide /><YAxis unit={unit} stroke="#6e7f91" /><Tooltip contentStyle={{ background: '#111821', border: '1px solid #223041' }} /><Legend />
  {keys.map(([k, c]) => <Line key={k} dataKey={k} stroke={c} dot={false} isAnimationActive={false} />)}</LineChart></ResponsiveContainer>
export default function Live({ src }) {
  const s = src === 'windows' ? 'windows' : 'linux', [active, setActive] = useState(true), [rng, setRng] = useState(60), [msg, setMsg] = useState(''), [err, setErr] = useState('')
  const { pts, last, status, error: liveErr } = useLive(src, active, 900), [procs, setProcs] = useState([]), data = pts.slice(-Math.round(rng / (s === 'linux' ? 1 : 3)))
  useEffect(() => {
    if (!active) return
    let on = true; const tick = () => api(`/api/scan/process?source=${s}`, 'POST').then(r => on && setProcs(r.rows)).catch(() => {})
    tick(); const i = setInterval(tick, 5000); return () => { on = false; clearInterval(i) }
  }, [active, s])
  const snap = async () => { try { await api('/api/snapshot', 'POST', { ...last, source: s }); setMsg('Snapshot saved') } catch (e) { setErr(e.message) } }
  return <div><Btn on={active} onClick={() => setActive(true)}>Start Live</Btn><Btn on={!active} onClick={() => setActive(false)}>Pause</Btn><Btn onClick={snap} disabled={!last}>Snapshot</Btn>
    {[[60, '1 min'], [300, '5 min'], [900, '15 min']].map(([v, l]) => <Btn key={v} on={rng === v} onClick={() => setRng(v)}>{l}</Btn>)}
    <span className="dim">{s} · {status} · {s === 'linux' ? '1 s' : '3 s'} sampling {msg}</span><ErrorBox error={err || liveErr} />
    {src === 'both' && <p className="dim">Both: showing Linux live; switch to Windows to see the host.</p>}
    {!last ? <p className="dim">{status === 'reconnecting' ? 'Connection lost, reconnecting...' : 'Waiting for data...'}</p> : <div className="grid">
      <Card title="CPU per core (htop)">{last.cores ? last.cores.map((c, i) => <Bar key={i} label={'cpu' + i} v={c} />) : <Bar label="cpu" v={last.cpu} />}</Card>
      <Card title="Disk / Memory"><Bar label="disk" v={last.disk} /><Bar label="ram" v={last.ram} /></Card></div>}
    <Top rows={procs} />
    <Card title="CPU and RAM %"><Chart data={data} keys={[['cpu', '#3fb950'], ['ram', '#58a6ff']]} unit="%" /></Card>
    <Card title="Network KB/s">{last?.rx !== undefined ? <Chart data={data} keys={[['rx', '#d29922'], ['tx', '#bc8cff']]} /> : <span className="dim">Network counters come from the Linux source.</span>}</Card></div>
}
