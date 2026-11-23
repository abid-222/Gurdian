import { useEffect, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { Play, Pause, Camera, Cpu, Server, HardDrive, Radio, Zap } from 'lucide-react'
import { api } from '../api'
import { useLive } from '../hooks/useLive'
import { Badge, Bar, Btn, Card, ErrorBox } from '../components/ui'
import { Top } from './Process'

const GradientChart = ({ data, lines, unit, id }) => (
  <ResponsiveContainer width="100%" height={200}>
    <AreaChart data={data}>
      <defs>
        {lines.map(([k, c]) => (
          <linearGradient key={k} id={`grad-${id}-${k}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={c} stopOpacity={0.45} />
            <stop offset="95%" stopColor={c} stopOpacity={0.0} />
          </linearGradient>
        ))}
      </defs>
      <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
      <XAxis hide />
      <YAxis unit={unit} stroke="var(--dim, #7982a9)" tick={{ fontSize: 11 }} />
      <Tooltip
        contentStyle={{
          background: 'var(--panel, #121826)',
          border: '1px solid var(--line, rgba(255,255,255,0.12))',
          color: 'var(--fg, #f1f5f9)',
          borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
        }}
      />
      <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
      {lines.map(([k, c, name]) => (
        <Area
          key={k}
          name={name || k}
          type="monotone"
          dataKey={k}
          stroke={c}
          strokeWidth={2.2}
          fillOpacity={1}
          fill={`url(#grad-${id}-${k})`}
          isAnimationActive={false}
        />
      ))}
    </AreaChart>
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

  // Primary live socket hook
  const { pts, last, status, error: liveErr } = useLive(src, active, 900)
  // Secondary hook when in "both" mode
  const winLive = useLive('windows', active && isBoth, 900)

  const data = pts.slice(-Math.round(rng / 1))
  const winData = winLive.pts.slice(-Math.round(rng / 1))

  useEffect(() => {
    if (!active) return
    let on = true
    const tick = () =>
      api(`/api/scan/process?source=${primarySrc}`, 'POST')
        .then(r => on && setProcs(r.rows || []))
        .catch(() => {})
    tick()
    const i = setInterval(tick, 4000)
    return () => {
      on = false
      clearInterval(i)
    }
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

  // Current metric helpers
  const cpuVal = last?.cpu != null ? Number(last.cpu) : null
  const ramVal = last?.ram != null ? Number(last.ram) : null
  const diskVal = last?.disk != null ? Number(last.disk) : null

  return (
    <div>
      {/* ── 3D Live Stream Command Header ── */}
      <div className="status-banner-3d">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'linear-gradient(135deg, rgba(99,102,241,0.25) 0%, rgba(56,189,248,0.25) 100%)',
              border: '1px solid rgba(99,102,241,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--c)',
              boxShadow: '0 0 16px rgba(99,102,241,0.3)'
            }}>
              <Zap size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ margin: 0, color: 'var(--fg)', fontSize: 16 }}>
                  Real-Time Kernel Telemetry & Live Hardware Stream
                </h3>
                <Badge
                  v={status === 'live' ? '1000ms LIVE STREAM' : status.toUpperCase()}
                  tone={status === 'live' ? 'g' : 'a'}
                />
              </div>
              <p className="dim" style={{ fontSize: 12, margin: '4px 0 0' }}>
                High-frequency WebSocket channel (<code style={{ color: 'var(--c)' }}>/ws/live?source={src}</code>). Directly streaming multi-core scheduler ticks, physical memory buffer, and socket bandwidth.
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
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
              <Btn key={v} on={rng === v} onClick={() => setRng(v)}>
                {l}
              </Btn>
            ))}
            {msg && (
              <span style={{ color: 'var(--g)', fontSize: 11, marginLeft: 4, fontWeight: 600 }}>
                ✓ {msg}
              </span>
            )}
          </div>
        </div>
      </div>

      <ErrorBox error={err || liveErr || winLive.error} />

      {/* ── 3D Hardware Telemetry HUD Cards ── */}
      {last && (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', marginBottom: 16 }}>
          <div className="card card-3d" style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span className="dim" style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                <Cpu size={15} color="var(--g)" /> CPU SCHEDULER
              </span>
              <Badge
                v={cpuVal > 80 ? 'HIGH' : cpuVal > 50 ? 'ELEVATED' : 'OPTIMAL'}
                tone={cpuVal > 80 ? 'r' : cpuVal > 50 ? 'a' : 'g'}
              />
            </div>
            <div className="stat" style={{ color: 'var(--g)' }}>{cpuVal != null ? `${cpuVal}%` : '—'}</div>
            <span className="dim" style={{ fontSize: 11 }}>Kernel Task Execution Rate</span>
          </div>

          <div className="card card-3d" style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span className="dim" style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                <Server size={15} color="var(--c)" /> PHYSICAL MEMORY
              </span>
              <Badge
                v={ramVal > 85 ? 'SATURATED' : 'HEALTHY'}
                tone={ramVal > 85 ? 'r' : 'c'}
              />
            </div>
            <div className="stat" style={{ color: 'var(--c)' }}>{ramVal != null ? `${ramVal}%` : '—'}</div>
            <span className="dim" style={{ fontSize: 11 }}>Active RAM Buffer Allocation</span>
          </div>

          <div className="card card-3d" style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span className="dim" style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                <HardDrive size={15} color="var(--a)" /> ROOT STORAGE
              </span>
              <Badge v="ONLINE" tone="a" />
            </div>
            <div className="stat" style={{ color: 'var(--a)' }}>{diskVal != null ? `${diskVal}%` : '—'}</div>
            <span className="dim" style={{ fontSize: 11 }}>Partition Mount Utilization</span>
          </div>

          <div className="card card-3d" style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span className="dim" style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                <Radio size={15} color="var(--p)" /> NETWORK BANDWIDTH
              </span>
              <Badge v="STREAMING" tone="p" />
            </div>
            <div className="stat" style={{ fontSize: 22, color: 'var(--p)' }}>
              {last.rx != null ? `${last.rx} KB/s` : '0 KB/s'}
            </div>
            <span className="dim" style={{ fontSize: 11 }}>
              {last.tx != null ? `${last.tx} KB/s TX Output` : 'Real-Time Socket I/O'}
            </span>
          </div>
        </div>
      )}

      {/* ── Multi-Core Processor Matrix (htop style) ── */}
      {last?.cores && (
        <Card className="card-3d" title="Multi-Core Processor Load Matrix (htop core scheduling)">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px 16px' }}>
            {last.cores.map((c, i) => (
              <Bar key={i} label={`cpu${i}`} v={c} />
            ))}
          </div>
        </Card>
      )}

      {/* ── Top CPU & RAM Consumers (Required by Vitest) ── */}
      <Top rows={procs} />

      {/* ── Real-Time Processor & Memory Area Chart ── */}
      <Card className="card-3d" title={isBoth ? "CPU and RAM % (Linux primary)" : "CPU and RAM %"}>
        <GradientChart
          id="cpu-ram"
          data={data}
          unit="%"
          lines={[
            ['cpu', '#10b981', 'CPU Utilization %'],
            ['ram', '#38bdf8', 'RAM Memory %']
          ]}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, fontSize: 11 }}>
          <span className="dim">📈 Green: CPU Core Load · Blue: Physical RAM Memory</span>
          <span className="dim">Baseline Threshold: 80% Safe Horizon</span>
        </div>
      </Card>

      {/* When Both is active: Show Windows Host Chart */}
      {isBoth && winData.length > 0 && (
        <Card className="card-3d" title="Windows Host CPU & RAM %">
          <GradientChart
            id="win-cpu-ram"
            data={winData}
            unit="%"
            lines={[
              ['cpu', '#f59e0b', 'Windows CPU %'],
              ['ram', '#c084fc', 'Windows RAM %']
            ]}
          />
        </Card>
      )}

      {/* ── Real-Time Network Bandwidth Throughput Chart ── */}
      <Card className="card-3d" title="Network KB/s (Real-Time Throughput)">
        {last?.rx !== undefined ? (
          <>
            <GradientChart
              id="net-io"
              data={data}
              unit=" KB/s"
              lines={[
                ['rx', '#38bdf8', 'Incoming Traffic (RX)'],
                ['tx', '#f43f5e', 'Outgoing Transmission (TX)']
              ]}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, fontSize: 11 }}>
              <span className="dim">🌐 Blue: Download Inbound (RX) · Red: Upload Outbound (TX)</span>
              <span className="dim">Continuous Socket Poll</span>
            </div>
          </>
        ) : (
          <span className="dim">Network counters streaming...</span>
        )}
      </Card>
    </div>
  )
}
