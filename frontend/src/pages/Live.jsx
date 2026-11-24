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
import { Play, Pause, Camera, Cpu, Server, HardDrive, Radio, Activity } from 'lucide-react'
import { api } from '../api'
import { useLive } from '../hooks/useLive'
import { Badge, Bar, Btn, Card, ErrorBox } from '../components/ui'
import { Top } from './Process'

const CleanChart = ({ data, lines, unit, id }) => (
  <ResponsiveContainer width="100%" height={200}>
    <AreaChart data={data}>
      <defs>
        {lines.map(([k, c]) => (
          <linearGradient key={k} id={`grad-${id}-${k}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={c} stopOpacity={0.25} />
            <stop offset="95%" stopColor={c} stopOpacity={0.0} />
          </linearGradient>
        ))}
      </defs>
      <CartesianGrid stroke="var(--line)" strokeDasharray="2 2" />
      <XAxis hide />
      <YAxis unit={unit} stroke="var(--dim)" tick={{ fontSize: 11 }} />
      <Tooltip
        contentStyle={{
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          color: 'var(--fg)',
          borderRadius: 6,
          fontSize: 12,
          boxShadow: 'var(--shadow-md)'
        }}
      />
      <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
      {lines.map(([k, c, name]) => (
        <Area
          key={k}
          name={name || k}
          type="monotone"
          dataKey={k}
          stroke={c}
          strokeWidth={1.8}
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
  const isWin = typeof navigator !== 'undefined' && /win/i.test(navigator.userAgent || navigator.platform || '')
  const primarySrc = src === 'windows' ? 'windows' : (src === 'both' ? (isWin ? 'windows' : 'linux') : 'linux')

  const [active, setActive] = useState(true)
  const [rng, setRng] = useState(60)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [procs, setProcs] = useState([])

  const { pts, last, status, error: liveErr } = useLive(src, active, 900)
  const winLive = useLive('windows', active && isBoth, 900)

  const data = pts.slice(-Math.round(rng / 1))
  const winData = winLive.pts.slice(-Math.round(rng / 1))

  useEffect(() => {
    if (!active) return
    let on = true
    const tick = () => {
      const sources = src === 'both' ? (isWin ? ['windows', 'linux'] : ['linux', 'windows']) : [primarySrc]
      Promise.allSettled(sources.map(s => api(`/api/scan/process?source=${s}`, 'POST')))
        .then(results => {
          if (!on) return
          const withRows = results.find(r => r.status === 'fulfilled' && r.value?.rows?.length > 0)
          if (withRows) {
            setProcs(withRows.value.rows)
          }
        })
        .catch(() => {})
    }
    tick()
    const i = setInterval(tick, 4000)
    return () => {
      on = false
      clearInterval(i)
    }
  }, [active, primarySrc, src, isWin])

  const snap = async () => {
    try {
      await api('/api/snapshot', 'POST', { ...last, source: primarySrc })
      setMsg('Snapshot saved')
      setTimeout(() => setMsg(''), 3000)
    } catch (e) {
      setErr(e.message)
    }
  }

  const cpuVal = last?.cpu != null ? Number(last.cpu) : null
  const ramVal = last?.ram != null ? Number(last.ram) : null
  const diskVal = last?.disk != null ? Number(last.disk) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── Live Stream Command Header ── */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              background: 'var(--panel-hover)',
              border: '1px solid var(--line)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent)'
            }}>
              <Activity size={20} strokeWidth={2} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ margin: 0, color: 'var(--fg)', fontSize: 16, fontWeight: 600 }}>
                  Live system telemetry
                </h3>
                <Badge
                  v={status === 'live' ? 'Live stream' : status}
                  tone={status === 'live' ? 'g' : 'a'}
                />
              </div>
              <p className="dim" style={{ fontSize: 12, margin: '4px 0 0' }}>
                High-frequency WebSocket channel (<code style={{ color: 'var(--fg)' }}>/ws/live?source={src}</code>). Real-time CPU, memory, and socket metrics.
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <Btn on={active} onClick={() => setActive(true)}>
              <Play size={13} /> Start Live
            </Btn>
            <Btn on={!active} onClick={() => setActive(false)}>
              <Pause size={13} /> Pause
            </Btn>
            <Btn onClick={snap} disabled={!last}>
              <Camera size={13} /> Snapshot
            </Btn>
            {[[60, '1 min'], [300, '5 min'], [900, '15 min']].map(([v, l]) => (
              <Btn key={v} on={rng === v} onClick={() => setRng(v)}>
                {l}
              </Btn>
            ))}
            {msg && (
              <span style={{ color: 'var(--g)', fontSize: 11, marginLeft: 4 }}>
                ✓ {msg}
              </span>
            )}
          </div>
        </div>
      </div>

      <ErrorBox error={err || liveErr || winLive.error} />

      {/* ── Hardware Telemetry HUD Cards ── */}
      {last && (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', marginBottom: 0 }}>
          <div className="card" style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span className="dim" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Cpu size={14} color="var(--dim)" /> CPU scheduler
              </span>
              <Badge
                v={cpuVal > 80 ? 'High' : cpuVal > 50 ? 'Elevated' : 'Optimal'}
                tone={cpuVal > 80 ? 'r' : cpuVal > 50 ? 'a' : 'g'}
              />
            </div>
            <div className="stat">{cpuVal != null ? `${cpuVal}%` : '—'}</div>
            <span className="dim" style={{ fontSize: 11 }}>Execution rate</span>
          </div>

          <div className="card" style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span className="dim" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Server size={14} color="var(--dim)" /> Physical memory
              </span>
              <Badge
                v={ramVal > 85 ? 'High' : 'Normal'}
                tone={ramVal > 85 ? 'r' : 'g'}
              />
            </div>
            <div className="stat">{ramVal != null ? `${ramVal}%` : '—'}</div>
            <span className="dim" style={{ fontSize: 11 }}>Active allocation</span>
          </div>

          <div className="card" style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span className="dim" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <HardDrive size={14} color="var(--dim)" /> Storage partition
              </span>
              <Badge v="Online" tone="g" />
            </div>
            <div className="stat">{diskVal != null ? `${diskVal}%` : '—'}</div>
            <span className="dim" style={{ fontSize: 11 }}>Root utilization</span>
          </div>

          <div className="card" style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span className="dim" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Radio size={14} color="var(--dim)" /> Network bandwidth
              </span>
              <Badge v="Streaming" tone="c" />
            </div>
            <div className="stat" style={{ fontSize: 22 }}>
              {last.rx != null ? `${last.rx} KB/s` : '0 KB/s'}
            </div>
            <span className="dim" style={{ fontSize: 11 }}>
              {last.tx != null ? `${last.tx} KB/s TX` : 'Socket traffic'}
            </span>
          </div>
        </div>
      )}

      {/* ── Multi-Core Processor Matrix ── */}
      {last?.cores && (
        <Card title="Multi-core processor load matrix">
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
      <Card title={isBoth ? "CPU and RAM % (Linux primary)" : "CPU and RAM %"}>
        <CleanChart
          id="cpu-ram"
          data={data}
          unit="%"
          lines={[
            ['cpu', 'var(--g)', 'CPU utilization %'],
            ['ram', 'var(--c)', 'RAM memory %']
          ]}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, fontSize: 11 }}>
          <span className="dim">Green: CPU load · Blue: Physical RAM</span>
          <span className="dim">80% threshold horizon</span>
        </div>
      </Card>

      {/* When Both is active: Show Windows Host Chart */}
      {isBoth && winData.length > 0 && (
        <Card title="Windows host CPU and RAM %">
          <CleanChart
            id="win-cpu-ram"
            data={winData}
            unit="%"
            lines={[
              ['cpu', 'var(--a)', 'Windows CPU %'],
              ['ram', 'var(--p)', 'Windows RAM %']
            ]}
          />
        </Card>
      )}

      {/* ── Real-Time Network Bandwidth Throughput Chart ── */}
      <Card title="Network KB/s (real-time throughput)">
        {last?.rx !== undefined ? (
          <>
            <CleanChart
              id="net-io"
              data={data}
              unit=" KB/s"
              lines={[
                ['rx', 'var(--c)', 'Incoming (RX)'],
                ['tx', 'var(--r)', 'Outgoing (TX)']
              ]}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, fontSize: 11 }}>
              <span className="dim">Blue: Download inbound (RX) · Red: Upload outbound (TX)</span>
              <span className="dim">Continuous socket poll</span>
            </div>
          </>
        ) : (
          <span className="dim">Network counters streaming…</span>
        )}
      </Card>
    </div>
  )
}
