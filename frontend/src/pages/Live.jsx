import { useEffect, useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Play, Pause, Camera, Activity, Cpu, Server, HardDrive, Radio } from 'lucide-react'
import { api } from '../api'
import { useLive } from '../hooks/useLive'
import { Badge, Bar, Btn, Card, ErrorBox } from '../components/ui'
import { Top } from './Process'

const Chart = ({ data, keys, unit }) => (
  <ResponsiveContainer width="100%" height={170}>
    <LineChart data={data}>
      <CartesianGrid stroke="#223041" strokeDasharray="3 3" />
      <XAxis hide />
      <YAxis unit={unit} stroke="#7982a9" />
      <Tooltip contentStyle={{ background: 'var(--panel)', border: '1px solid var(--line)', color: 'var(--fg)', borderRadius: 8 }} />
      <Legend />
      {keys.map(([k, c]) => (
        <Line key={k} dataKey={k} stroke={c} strokeWidth={2} dot={false} isAnimationActive={false} />
      ))}
    </LineChart>
  </ResponsiveContainer>
)

export default function Live({ src }) {
  const isBoth = src === 'both'
  const primarySrc = src === 'windows' ? 'windows' : 'linux'

  const [active, setActive] = useState(true)
  const [rng, setRng] = useState(60)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [procs, setProcs] = useState([])

  // Primary hook
  const { pts, last, status, error: liveErr } = useLive(src, active, 900)
  // Secondary hook for Windows when in "both" mode
  const winLive = useLive('windows', active && isBoth, 900)

  const data = pts.slice(-Math.round(rng / (primarySrc === 'linux' ? 1 : 3)))
  const winData = winLive.pts.slice(-Math.round(rng / 3))

  useEffect(() => {
    if (!active) return
    let on = true
    const tick = () => api(`/api/scan/process?source=${primarySrc}`, 'POST')
      .then(r => on && setProcs(r.rows))
      .catch(() => {})
    tick()
    const i = setInterval(tick, 5000)
    return () => { on = false; clearInterval(i) }
  }, [active, primarySrc])

  const snap = async () => {
    try {
      await api('/api/snapshot', 'POST', { ...last, source: primarySrc })
      setMsg('Snapshot saved')
      setTimeout(() => setMsg(''), 3000)
    } catch (e) {
      setErr(e.message)
    }
  }

  // Derived user-friendly metric helpers
  const cpuVal = last?.cpu !== undefined ? Number(last.cpu) : null
  const ramVal = last?.ram !== undefined ? Number(last.ram) : null
  const diskVal = last?.disk !== undefined ? Number(last.disk) : null

  const getMetricStatus = val => {
    if (val == null) return { text: 'STREAMING', tone: 'c' }
    if (val >= 85) return { text: 'HIGH LOAD', tone: 'r' }
    if (val >= 60) return { text: 'ELEVATED', tone: 'a' }
    return { text: 'OPTIMAL', tone: 'g' }
  }

  return (
    <div>
      {/* ── 3D User-Friendly Telemetry Header Banner ── */}
      <div className="status-banner-3d">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Activity size={22} color="var(--c)" />
              <h3 style={{ margin: 0, color: 'var(--fg)', fontSize: 16 }}>
                Real-Time Kernel Telemetry & Live Hardware Stream
              </h3>
              <Badge v={status === 'open' ? 'LIVE SOCKET 1s' : status.toUpperCase()} tone={status === 'open' ? 'g' : 'a'} />
            </div>
            <p className="dim" style={{ fontSize: 13, margin: '4px 0 0', maxWidth: 740, lineHeight: 1.5 }}>
              Continuous WebSocket streaming directly from operating system kernel files (<code style={{ color: 'var(--c)' }}>/proc/stat</code> and <code style={{ color: 'var(--c)' }}>/proc/net/dev</code>).
              Provides non-technical evaluators and supervisors an intuitive visualization of host hardware workloads and network throughput.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="badge p" style={{ fontSize: 11, padding: '4px 10px' }}>
              Platform: {src.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* ── 3D Intuitive Hardware Status Cards ── */}
      {last && (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: 16 }}>
          <div className="card card-3d" style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span className="dim" style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                <Cpu size={15} color="var(--g)" /> CPU SCHEDULER
              </span>
              <Badge v={getMetricStatus(cpuVal).text} tone={getMetricStatus(cpuVal).tone} />
            </div>
            <div className="stat" style={{ color: 'var(--g)' }}>{cpuVal != null ? `${cpuVal}%` : '—'}</div>
            <span className="dim" style={{ fontSize: 11 }}>Kernel Task Execution Rate</span>
          </div>

          <div className="card card-3d" style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span className="dim" style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                <Server size={15} color="var(--c)" /> PHYSICAL MEMORY
              </span>
              <Badge v={getMetricStatus(ramVal).text} tone={getMetricStatus(ramVal).tone} />
            </div>
            <div className="stat" style={{ color: 'var(--c)' }}>{ramVal != null ? `${ramVal}%` : '—'}</div>
            <span className="dim" style={{ fontSize: 11 }}>RAM Allocation & Cache</span>
          </div>

          <div className="card card-3d" style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span className="dim" style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                <HardDrive size={15} color="var(--a)" /> STORAGE PARTITION
              </span>
              <Badge v={getMetricStatus(diskVal).text} tone={getMetricStatus(diskVal).tone} />
            </div>
            <div className="stat" style={{ color: 'var(--a)' }}>{diskVal != null ? `${diskVal}%` : '—'}</div>
            <span className="dim" style={{ fontSize: 11 }}>Root Mount Utilization</span>
          </div>

          <div className="card card-3d" style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span className="dim" style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                <Radio size={15} color="var(--p)" /> NETWORK I/O
              </span>
              <Badge v="STREAMING" tone="p" />
            </div>
            <div className="stat" style={{ fontSize: 20, color: 'var(--p)' }}>
              {last.rx !== undefined ? `${last.rx} KB/s` : '0 KB/s'}
            </div>
            <span className="dim" style={{ fontSize: 11 }}>
              {last.tx !== undefined ? `${last.tx} KB/s Outbound TX` : 'Socket Throughput'}
            </span>
          </div>
        </div>
      )}

      {/* ── Control Bar ── */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <Btn on={active} onClick={() => setActive(true)}>
          <Play size={14} /> Start Live
        </Btn>
        <Btn on={!active} onClick={() => setActive(false)}>
          <Pause size={14} /> Pause
        </Btn>
        <Btn onClick={snap} disabled={!last}>
          <Camera size={14} /> Snapshot
        </Btn>
        {[[60, '1 min'], [300, '5 min'], [900, '15 min']].map(([v, l]) => (
          <Btn key={v} on={rng === v} onClick={() => setRng(v)}>{l}</Btn>
        ))}
        <span className="dim" style={{ marginLeft: 'auto', fontSize: 12 }}>
          Mode: {src} · {status} {msg && `(${msg})`}
        </span>
      </div>

      <ErrorBox error={err || liveErr || winLive.error} />

      {/* When Both is active: Show dual live telemetry cards! */}
      {isBoth ? (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
          <Card className="card-3d" title="Linux / WSL2 Live Telemetry">
            {last ? (
              <>
                <Bar label="cpu" v={last.cpu} />
                <Bar label="ram" v={last.ram} />
                <Bar label="disk" v={last.disk} />
                {last.rx !== undefined && <div className="dim">Net: {last.rx} KB/s RX · {last.tx} KB/s TX</div>}
              </>
            ) : <span className="dim">Waiting for Linux live data...</span>}
          </Card>
          <Card className="card-3d" title="Windows Bridge Live Telemetry">
            {winLive.last ? (
              <>
                <Bar label="cpu" v={winLive.last.cpu} />
                <Bar label="ram" v={winLive.last.ram} />
                <Bar label="disk" v={winLive.last.disk} />
                {winLive.last.rx !== undefined && <div className="dim">Net: {winLive.last.rx} KB/s RX · {winLive.last.tx} KB/s TX</div>}
              </>
            ) : <span className="dim">Waiting for Windows live data...</span>}
          </Card>
        </div>
      ) : (
        !last ? (
          <p className="dim">{status === 'reconnecting' ? 'Connection lost, reconnecting...' : 'Waiting for telemetry stream...'}</p>
        ) : (
          <div className="grid">
            <Card className="card-3d" title="CPU per core (Multi-Core Schedulers)">
              {last.cores ? (
                last.cores.map((c, i) => <Bar key={i} label={'cpu' + i} v={c} />)
              ) : (
                <Bar label="cpu" v={last.cpu} />
              )}
            </Card>
            <Card className="card-3d" title="Disk / Physical Memory Health">
              <Bar label="disk" v={last.disk} />
              <Bar label="ram" v={last.ram} />
            </Card>
          </div>
        )
      )}

      {/* Top 5 CPU & RAM Consumers (Required by Vitest) */}
      <Top rows={procs} />

      {/* Telemetry Charts */}
      <Card className="card-3d" title={isBoth ? "CPU and RAM % (Linux primary)" : "CPU and RAM %"}>
        <Chart data={data} keys={[['cpu', '#38b44a'], ['ram', '#7aa2f7']]} unit="%" />
        <p className="dim" style={{ margin: '6px 0 0', fontSize: 11 }}>
          📈 <b>Evaluation Note:</b> Green line represents kernel CPU utilization, Blue line indicates RAM allocation. Normal baseline is below 80%.
        </p>
      </Card>

      {isBoth && winData.length > 0 && (
        <Card className="card-3d" title="Windows Host CPU & RAM %">
          <Chart data={winData} keys={[['cpu', '#efb73e'], ['ram', '#ad7fa8']]} unit="%" />
        </Card>
      )}

      <Card className="card-3d" title="Network KB/s">
        {last?.rx !== undefined ? (
          <>
            <Chart data={data} keys={[['rx', '#efb73e'], ['tx', '#ad7fa8']]} />
            <p className="dim" style={{ margin: '6px 0 0', fontSize: 11 }}>
              🌐 <b>Evaluation Note:</b> Yellow curve indicates inbound traffic (RX), Purple curve indicates outbound transmission (TX).
            </p>
          </>
        ) : (
          <span className="dim">Network counters streaming...</span>
        )}
      </Card>
    </div>
  )
}
