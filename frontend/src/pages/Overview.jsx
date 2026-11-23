import { useCallback, useEffect, useState } from 'react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../api'
import { useLive } from '../hooks/useLive'
import { Badge, Btn, Card, ErrorBox, Gauge, Stat } from '../components/ui'
import { Top } from './Process'

const ASCII_LOGO = `
       /\\
      /  \\       
     / /\\ \\      
    / /  \\ \\     
   / /    \\ \\    
  / /  /\\  \\ \\   
 / /__/  \\__\\ \\  
 \\_____/\\_____/  
`

export default function Overview({ src, bump }) {
  const [score, setScore] = useState(0)
  const [al, setAl] = useState([])
  const [info, setInfo] = useState(null)
  const [hist, setHist] = useState([])
  const [prog, setProg] = useState(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [at, setAt] = useState('-')
  const [health, setHealth] = useState({ ok: false, checking: true, latency: 0, sources: [] })
  const [procs, setProcs] = useState([])

  const { last, status } = useLive(src)

  const checkHealth = useCallback(async () => {
    const t0 = performance.now()
    try {
      const h = await api('/api/health')
      const latency = Math.round(performance.now() - t0)
      setHealth({ ok: Boolean(h.ok), sources: h.sources || [], latency, checking: false })
    } catch {
      setHealth({ ok: false, sources: [], latency: 0, checking: false })
    }
  }, [])

  const fetchAll = useCallback(() => Promise.all([
    api('/api/score'),
    api('/api/alerts'),
    api('/api/info'),
    api('/api/score/history?hours=24'),
    api(`/api/scan/process?source=${src === 'windows' ? 'windows' : 'linux'}`).catch(() => ({ rows: [] }))
  ]), [src])

  const apply = useCallback(([s, a, i, h, p]) => {
    setScore(s.score)
    setAl(a)
    setInfo(i)
    setHist(h.map(x => ({
      t: new Date(x.ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      score: x.score
    })))
    if (p?.rows) setProcs(p.rows)
    setErr('')
    bump()
  }, [bump])

  const load = async () => {
    setLoading(true)
    try {
      checkHealth()
      apply(await fetchAll())
    } catch (e) {
      setErr(e.message)
    }
    setLoading(false)
  }

  useEffect(() => {
    let on = true
    const t0 = performance.now()
    api('/api/health')
      .then(h => {
        if (on) {
          const latency = Math.round(performance.now() - t0)
          setHealth({ ok: Boolean(h.ok), sources: h.sources || [], latency, checking: false })
        }
      })
      .catch(() => {
        if (on) setHealth({ ok: false, sources: [], latency: 0, checking: false })
      })

    fetchAll().then(d => on && apply(d)).catch(e => on && setErr(e.message))
    return () => { on = false }
  }, [fetchAll, apply])

  const full = async () => {
    const mods = ['process', 'network', 'integrity', 'persistence', 'usb', 'auth']
    for (let i = 0; i < mods.length; i++) {
      setProg(i)
      await Promise.all((src === 'both' ? ['linux', 'windows'] : [src]).map(s => api(`/api/scan/${mods[i]}?source=${s}`, 'POST').catch(() => {})))
    }
    setProg(null)
    setAt(new Date().toLocaleTimeString())
    load()
  }

  return (
    <div>
      <ErrorBox error={err} />

      {/* Real Dynamic Service Health Bar */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: health.ok ? 'var(--g)' : 'var(--r)', fontWeight: 'bold' }}>
              [{health.ok ? '  OK  ' : ' FAIL '}]
            </span>
            <span><b>guardian-api.service</b></span>
            <Badge v={health.ok ? 'ONLINE' : 'OFFLINE'} tone={health.ok ? 'g' : 'r'} />
            {health.latency > 0 && <span className="dim">({health.latency} ms)</span>}
          </div>
          <div className="dim">
            Active Collectors: {health.sources ? health.sources.join(', ') : 'detecting...'} · WebSocket: {status}
          </div>
        </div>
      </Card>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <Btn onClick={full} loading={prog !== null}>
          {prog === null ? 'Run Full Scan' : `Scanning ${prog + 1}/6...`}
        </Btn>
        <Btn onClick={load} loading={loading}>Refresh</Btn>
        <a href="/api/report?fmt=html" download>
          <Btn>Export Report</Btn>
        </a>
        <span className="dim" style={{ marginLeft: 'auto' }}>
          last scan: {at} · live stream: {status}
        </span>
      </div>

      {/* Neofetch & System Specs Block */}
      <div className="card neofetch-block">
        <pre className="neofetch-art">{ASCII_LOGO}</pre>
        <div className="neofetch-info">
          <div><b style={{ color: 'var(--c)' }}>smart-os-guardian</b>@<b style={{ color: 'var(--g)' }}>{info?.host || 'host'}</b></div>
          <div style={{ color: 'var(--dim)', margin: '2px 0 6px' }}>-----------------------------</div>
          <div><b>OS</b>: {info?.os || 'Linux / Windows Bridge'}</div>
          <div><b>Kernel</b>: {info?.kernel || '-'}</div>
          <div><b>Uptime</b>: {info ? `${Math.floor(info.uptime_s / 3600)}h ${Math.floor((info.uptime_s % 3600) / 60)}m` : '-'}</div>
          <div><b>CPU</b>: {info ? `${info.cpus} logical cores` : '-'}</div>
          <div><b>Memory</b>: {info ? `${info.mem_mb} MB total` : '-'}</div>
          <div><b>Security Level</b>: <Badge v={score < 30 ? 'SAFE' : score < 60 ? 'WARNING' : 'CRITICAL'} /> (Score: {score}/100)</div>
          <div className="neofetch-palette">
            {['#ef2929', '#f57900', '#efb73e', '#38b44a', '#7aa2f7', '#ad7fa8', '#ffffff'].map(c => (
              <i key={c} style={{ background: c }} />
            ))}
          </div>
        </div>
      </div>

      {/* Risk Gauge & Telemetry Stats */}
      <div className="grid">
        <Card title="Current Risk score">
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Gauge score={score} />
          </div>
        </Card>
        <Stat label="CPU Load" value={last ? `${last.cpu}%` : '-'} sub={src} />
        <Stat label="RAM Utilization" value={last ? `${last.ram}%` : '-'} sub={last ? `disk ${last.disk}%` : ''} />
        <Stat label="Network Throughput" value={last?.rx !== undefined ? `${last.rx} KB/s` : '-'} sub={last?.tx !== undefined ? `tx ${last.tx} KB/s` : 'rx/tx monitor'} />
        <Stat label="Unacknowledged Alerts" value={al.filter(a => !a.acknowledged).length} sub={`${al.length} total alerts`} />
      </div>

      {/* Top Processes */}
      {procs.length > 0 && <Top rows={procs} />}

      {/* Risk Score History (24h) */}
      <Card title="Risk score history (24 h)">
        {hist.length ? (
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={hist}>
              <XAxis dataKey="t" stroke="#7982a9" />
              <YAxis domain={[0, 100]} stroke="#7982a9" />
              <Tooltip contentStyle={{ background: 'var(--panel)', border: '1px solid var(--line)', color: 'var(--fg)' }} />
              <Line type="stepAfter" dataKey="score" stroke="#ef2929" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <span className="dim">No score changes recorded yet. Run a scan.</span>
        )}
      </Card>

      {/* Last 5 Alerts */}
      <Card title="Last 5 alerts">
        {al.slice(0, 5).map(a => (
          <div key={a.id} style={{ padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <Badge v={a.severity} /> [{a.module}/{a.source}] {a.message}
          </div>
        ))}
        {!al.length && <span className="dim">No alerts. Run a scan.</span>}
      </Card>
    </div>
  )
}
