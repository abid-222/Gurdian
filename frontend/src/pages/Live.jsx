import { useEffect, useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../api'
import { useLive } from '../hooks/useLive'
import { Bar, Btn, Card, ErrorBox } from '../components/ui'
import { Top } from './Process'

const Chart = ({ data, keys, unit }) => (
  <ResponsiveContainer width="100%" height={170}>
    <LineChart data={data}>
      <CartesianGrid stroke="#223041" strokeDasharray="3 3" />
      <XAxis hide />
      <YAxis unit={unit} stroke="#7982a9" />
      <Tooltip contentStyle={{ background: 'var(--panel)', border: '1px solid var(--line)', color: 'var(--fg)' }} />
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

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <Btn on={active} onClick={() => setActive(true)}>Start Live</Btn>
        <Btn on={!active} onClick={() => setActive(false)}>Pause</Btn>
        <Btn onClick={snap} disabled={!last}>Snapshot</Btn>
        {[[60, '1 min'], [300, '5 min'], [900, '15 min']].map(([v, l]) => (
          <Btn key={v} on={rng === v} onClick={() => setRng(v)}>{l}</Btn>
        ))}
        <span className="dim">
          mode: {src} · {status} {msg && `(${msg})`}
        </span>
      </div>

      <ErrorBox error={err || liveErr || winLive.error} />

      {/* When Both is active: Show dual live telemetry cards! */}
      {isBoth ? (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
          <Card title="🐧 Linux / WSL2 Live">
            {last ? (
              <>
                <Bar label="cpu" v={last.cpu} />
                <Bar label="ram" v={last.ram} />
                <Bar label="disk" v={last.disk} />
                {last.rx !== undefined && <div className="dim">Net: {last.rx} KB/s RX · {last.tx} KB/s TX</div>}
              </>
            ) : <span className="dim">Waiting for Linux live data...</span>}
          </Card>
          <Card title="🪟 Windows Bridge Live">
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
          <p className="dim">{status === 'reconnecting' ? 'Connection lost, reconnecting...' : 'Waiting for data...'}</p>
        ) : (
          <div className="grid">
            <Card title="CPU per core (htop)">
              {last.cores ? (
                last.cores.map((c, i) => <Bar key={i} label={'cpu' + i} v={c} />)
              ) : (
                <Bar label="cpu" v={last.cpu} />
              )}
            </Card>
            <Card title="Disk / Memory">
              <Bar label="disk" v={last.disk} />
              <Bar label="ram" v={last.ram} />
            </Card>
          </div>
        )
      )}

      {/* Top 5 CPU & RAM Consumers */}
      <Top rows={procs} />

      {/* Telemetry Charts */}
      <Card title={isBoth ? "CPU and RAM % (Linux primary)" : "CPU and RAM %"}>
        <Chart data={data} keys={[['cpu', '#38b44a'], ['ram', '#7aa2f7']]} unit="%" />
      </Card>

      {isBoth && winData.length > 0 && (
        <Card title="Windows Host CPU & RAM %">
          <Chart data={winData} keys={[['cpu', '#efb73e'], ['ram', '#ad7fa8']]} unit="%" />
        </Card>
      )}

      <Card title="Network KB/s">
        {last?.rx !== undefined ? (
          <Chart data={data} keys={[['rx', '#efb73e'], ['tx', '#ad7fa8']]} />
        ) : (
          <span className="dim">Network counters streaming...</span>
        )}
      </Card>
    </div>
  )
}
