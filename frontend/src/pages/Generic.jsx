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

  // Auto-refresh when liveAuto is enabled
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

  // Get first valid telemetry row
  const rows = data?.rows || []
  const sys = currentMod === 'system' && rows.length > 0 ? rows[0] : null
  const cpuVal = parseFloat(sys?.cpu_pct || 0)
  const ramVal = parseFloat(sys?.ram_pct || 0)
  const diskVal = parseFloat(sys?.disk_pct || 0)
  const isHighLoad = cpuVal > 80 || ramVal > 85

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* ── User-Friendly System Health Banner ── */}
      {currentMod === 'system' && (
        <div className="status-banner-3d">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: isHighLoad
                    ? 'linear-gradient(135deg, rgba(239,68,68,0.2) 0%, rgba(249,115,22,0.2) 100%)'
                    : 'linear-gradient(135deg, rgba(16,185,129,0.2) 0%, rgba(56,189,248,0.2) 100%)',
                  border: `1.5px solid ${isHighLoad ? 'rgba(239,68,68,0.4)' : 'rgba(16,185,129,0.4)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isHighLoad ? 'var(--r)' : 'var(--g)',
                  boxShadow: `0 0 16px ${isHighLoad ? 'rgba(239,68,68,0.25)' : 'rgba(16,185,129,0.25)'}`
                }}
              >
                <Server size={24} strokeWidth={2.2} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h3 style={{ margin: 0, color: 'var(--fg)', fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>
                    System Health & Performance
                  </h3>
                  <Badge
                    v={isHighLoad ? 'HIGH WORKLOAD' : 'ALL SYSTEMS HEALTHY'}
                    tone={isHighLoad ? 'r' : 'g'}
                  />
                </div>
                <p className="dim" style={{ margin: '4px 0 0', fontSize: 12.5 }}>
                  Real-time overview of your computer's processor, memory, storage, and network activity.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {/* Live Polling Switch */}
              <button
                className={`btn btn-sm ${liveAuto ? 'on' : ''}`}
                onClick={() => setLiveAuto(!liveAuto)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: liveAuto ? 'rgba(16,185,129,0.18)' : 'rgba(255,255,255,0.05)',
                  borderColor: liveAuto ? 'var(--g)' : 'var(--line)',
                  color: liveAuto ? 'var(--g)' : 'var(--fg)',
                  fontWeight: 600,
                  padding: '6px 12px',
                  borderRadius: 8
                }}
                title="Automatically refresh performance metrics every 4 seconds"
              >
                <Radio size={13} className={liveAuto ? 'spin' : ''} />
                <span>{liveAuto ? 'Auto Refresh: ON' : 'Auto Refresh: OFF'}</span>
              </button>

              <span className="badge p" style={{ fontSize: 11, padding: '4px 10px', borderRadius: 8 }}>
                Platform: {src.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── 4 Clean User-Friendly Resource Cards ── */}
      {currentMod === 'system' && sys && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {/* CPU Card */}
          <Card className="card-3d" style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span className="dim" style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase' }}>Processor (CPU)</span>
              <Cpu size={17} color="#38bdf8" />
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: cpuVal > 80 ? 'var(--r)' : cpuVal > 50 ? 'var(--a)' : 'var(--g)' }}>
              {cpuVal}%
            </div>
            <div className="dim" style={{ fontSize: 11.5, marginTop: 2 }}>
              {cpuVal > 80 ? 'Heavy Load Active' : cpuVal > 40 ? 'Moderate Activity' : 'Normal & Smooth'}
            </div>
            <div style={{ marginTop: 8, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
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
          <Card className="card-3d" style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span className="dim" style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase' }}>Memory (RAM)</span>
              <Activity size={17} color="#818cf8" />
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: ramVal > 85 ? 'var(--r)' : 'var(--c)' }}>
              {ramVal}%
            </div>
            <div className="dim" style={{ fontSize: 11.5, marginTop: 2 }}>
              {ramVal > 85 ? 'High Memory Usage' : 'Healthy Allocation'}
            </div>
            <div style={{ marginTop: 8, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.min(100, ramVal)}%`,
                  height: '100%',
                  background: ramVal > 85 ? 'var(--r)' : 'var(--c)'
                }}
              />
            </div>
          </Card>

          {/* Storage Card */}
          <Card className="card-3d" style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span className="dim" style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase' }}>Disk Storage</span>
              <HardDrive size={17} color="#34d399" />
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: diskVal > 90 ? 'var(--r)' : 'var(--fg)' }}>
              {diskVal}%
            </div>
            <div className="dim" style={{ fontSize: 11.5, marginTop: 2 }}>
              Main Drive Space Used
            </div>
            <div style={{ marginTop: 8, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
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
          <Card className="card-3d" style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span className="dim" style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase' }}>System Status</span>
              <CheckCircle2 size={17} color="#34d399" />
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--g)', marginTop: 4 }}>
              Active & Protected
            </div>
            <div className="dim" style={{ fontSize: 11.5, marginTop: 4 }}>
              Uptime: {sys.uptime_s ? `${Math.floor(sys.uptime_s / 3600)}h ${Math.floor((sys.uptime_s % 3600) / 60)}m` : 'Running'}
            </div>
          </Card>
        </div>
      )}

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Btn onClick={run} loading={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh System Status
        </Btn>
        {currentMod === 'system' && (
          <Btn onClick={history} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Camera size={14} /> View History Snapshots
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
          <Card className="card-3d" title="Hardware Resource Meters">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '6px 0' }}>
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
            sub="Total active host runtime"
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
        className="card-3d"
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Layers size={16} color="var(--c)" />
            <span>Detailed Hardware Metrics & System Logs</span>
          </span>
        }
      >
        <Table rows={data?.rows} />
      </Card>

      {/* ── Saved Snapshots Drawer ── */}
      {snaps && (
        <div style={{ marginTop: 14 }}>
          <Card className="card-3d" title="Saved History Snapshots">
            <Table rows={snaps} />
          </Card>
        </div>
      )}
    </div>
  )
}
