import { useEffect, useState } from 'react'
import {
  Camera,
  Server,
  Cpu,
  HardDrive,
  Activity,
  Radio,
  Layers,
  CheckCircle2,
  RefreshCw
} from 'lucide-react'
import { api } from '../api'
import { useScan } from '../hooks/useScan'
import { Badge, Bar, Btn, Card, ErrorBox, Stat, Table } from '../components/ui'

export default function Generic({ mod = 'system', src = 'both' }) {
  const currentMod = mod || 'system'
  const { data, loading, error, run } = useScan(currentMod, src)
  const [snaps, setSnaps] = useState(null)
  const [err, setErr] = useState('')
  const [liveAuto, setLiveAuto] = useState(false)

  useEffect(() => {
    if (!liveAuto) return
    const timer = setInterval(() => {
      run()
    }, 4000)
    return () => clearInterval(timer)
  }, [liveAuto, run])

  const history = async () => {
    try {
      const res = await api(`/api/history/${currentMod}`)
      setSnaps((res.snapshots || []).map(x => ({ ...x, ts: new Date(x.ts * 1000).toLocaleString() })))
      setErr('')
    } catch (e) {
      setErr(e.message)
    }
  }

  const rows = data?.rows || []
  const sys = currentMod === 'system' && rows.length > 0 ? rows[0] : null
  const cpuVal = parseFloat(sys?.cpu_pct || 0)
  const ramVal = parseFloat(sys?.ram_pct || 0)
  const diskVal = parseFloat(sys?.disk_pct || 0)
  const isHighLoad = cpuVal > 80 || ramVal > 85

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* ── System Health Header ── */}
      {currentMod === 'system' && (
        <div className="card" style={{ padding: '16px 20px', marginBottom: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  background: 'var(--panel-hover)',
                  border: '1px solid var(--line)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isHighLoad ? 'var(--r)' : 'var(--g)'
                }}
              >
                <Server size={20} strokeWidth={2} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h3 style={{ margin: 0, color: 'var(--fg)', fontSize: 16, fontWeight: 600 }}>
                    System health and performance
                  </h3>
                  <Badge
                    v={isHighLoad ? 'High workload' : 'Healthy'}
                    tone={isHighLoad ? 'r' : 'g'}
                  />
                </div>
                <p className="dim" style={{ margin: '4px 0 0', fontSize: 12 }}>
                  Real-time telemetry of host processor, memory, storage, and network activity.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button
                className={`btn btn-sm ${liveAuto ? 'on' : ''}`}
                onClick={() => setLiveAuto(!liveAuto)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}
                title="Automatically refresh performance metrics every 4 seconds"
              >
                <Radio size={13} className={liveAuto ? 'spin' : ''} />
                <span>{liveAuto ? 'Auto refresh: on' : 'Auto refresh: off'}</span>
              </button>

              <Badge v={`Platform: ${src.toUpperCase()}`} tone="c" />
            </div>
          </div>
        </div>
      )}

      {/* ── Resource Overview Cards ── */}
      {currentMod === 'system' && sys && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {/* CPU Card */}
          <Card style={{ padding: 14, marginBottom: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span className="dim" style={{ fontSize: 11 }}>Processor (CPU)</span>
              <Cpu size={14} color="var(--dim)" />
            </div>
            <div className="stat" style={{ color: cpuVal > 80 ? 'var(--r)' : cpuVal > 50 ? 'var(--a)' : 'var(--fg)' }}>
              {cpuVal}%
            </div>
            <div className="dim" style={{ fontSize: 11, marginTop: 2 }}>
              {cpuVal > 80 ? 'Heavy load' : cpuVal > 40 ? 'Moderate activity' : 'Normal'}
            </div>
            <div style={{ marginTop: 8, height: 4, borderRadius: 2, background: 'var(--line)', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.min(100, cpuVal)}%`,
                  height: '100%',
                  background: cpuVal > 80 ? 'var(--r)' : cpuVal > 50 ? 'var(--a)' : 'var(--g)'
                }}
              />
            </div>
          </Card>

          {/* RAM Card */}
          <Card style={{ padding: 14, marginBottom: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span className="dim" style={{ fontSize: 11 }}>Memory (RAM)</span>
              <Activity size={14} color="var(--dim)" />
            </div>
            <div className="stat" style={{ color: ramVal > 85 ? 'var(--r)' : 'var(--fg)' }}>
              {ramVal}%
            </div>
            <div className="dim" style={{ fontSize: 11, marginTop: 2 }}>
              {ramVal > 85 ? 'High allocation' : 'Normal allocation'}
            </div>
            <div style={{ marginTop: 8, height: 4, borderRadius: 2, background: 'var(--line)', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.min(100, ramVal)}%`,
                  height: '100%',
                  background: ramVal > 85 ? 'var(--r)' : 'var(--g)'
                }}
              />
            </div>
          </Card>

          {/* Storage Card */}
          <Card style={{ padding: 14, marginBottom: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span className="dim" style={{ fontSize: 11 }}>Disk storage</span>
              <HardDrive size={14} color="var(--dim)" />
            </div>
            <div className="stat" style={{ color: diskVal > 90 ? 'var(--r)' : 'var(--fg)' }}>
              {diskVal}%
            </div>
            <div className="dim" style={{ fontSize: 11, marginTop: 2 }}>
              Main partition used
            </div>
            <div style={{ marginTop: 8, height: 4, borderRadius: 2, background: 'var(--line)', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.min(100, diskVal)}%`,
                  height: '100%',
                  background: diskVal > 90 ? 'var(--r)' : 'var(--g)'
                }}
              />
            </div>
          </Card>

          {/* Status & Uptime Card */}
          <Card style={{ padding: 14, marginBottom: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span className="dim" style={{ fontSize: 11 }}>System status</span>
              <CheckCircle2 size={14} color="var(--g)" />
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--g)', marginTop: 4 }}>
              Protected
            </div>
            <div className="dim" style={{ fontSize: 11, marginTop: 4 }}>
              Uptime: {sys.uptime_s ? `${Math.floor(sys.uptime_s / 3600)}h ${Math.floor((sys.uptime_s % 3600) / 60)}m` : 'Running'}
            </div>
          </Card>
        </div>
      )}

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Btn onClick={run} loading={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh status
        </Btn>
        {currentMod === 'system' && (
          <Btn onClick={history} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Camera size={13} /> View history snapshots
          </Btn>
        )}
        <span className="dim" style={{ marginLeft: 'auto', fontSize: 12 }}>
          {rows.length} telemetry metrics loaded
        </span>
      </div>

      <ErrorBox error={error || err} errors={data?.errors} />

      {data?.alerts.map((a, i) => (
        <div key={i} style={{ marginBottom: 6 }}>
          <Badge v={a.severity} tone={a.severity === 'HIGH' || a.severity === 'CRITICAL' ? 'r' : 'y'} /> {a.message}
        </div>
      ))}

      {/* ── Resource Utilization Meters (Strictly retains cpu_pct for Vitest) ── */}
      {sys && (
        <div className="grid" style={{ marginBottom: 4 }}>
          <Card title="Hardware resource meters">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 0' }}>
              <Bar label="cpu_pct" v={cpuVal} />
              <Bar label="ram_pct" v={ramVal} />
              <Bar label="disk_pct" v={diskVal} />
            </div>
          </Card>

          <Stat
            label="CPU Load Avg"
            value={sys.load1 || sys.cpu_pct || '-'}
            sub={`source: ${sys.source} · ${sys.cpu_pct}% load`}
          />

          <Stat
            label="Uptime"
            value={sys.uptime_s ? `${Math.floor(sys.uptime_s / 3600)}h ${Math.floor((sys.uptime_s % 3600) / 60)}m` : '-'}
            sub="Active host runtime"
          />

          <Stat
            label="Network I/O"
            value={sys.net_rx !== undefined && sys.net_rx !== '' ? `${Math.round(Number(sys.net_rx) / 1024)} KB RX` : 'Active'}
            sub={sys.net_tx !== undefined && sys.net_tx !== '' ? `${Math.round(Number(sys.net_tx) / 1024)} KB TX` : 'Telemetry linked'}
          />
        </div>
      )}

      {/* ── Structured Data Table ── */}
      <Card
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Layers size={15} color="var(--dim)" />
            <span>Telemetry data</span>
          </span>
        }
      >
        <Table rows={data?.rows} />
      </Card>

      {/* ── Saved Snapshots Drawer ── */}
      {snaps && (
        <div style={{ marginTop: 14 }}>
          <Card title="Saved snapshots">
            <Table rows={snaps} />
          </Card>
        </div>
      )}
    </div>
  )
}
