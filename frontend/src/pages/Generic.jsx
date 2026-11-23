import { useEffect, useState } from 'react'
import {
  Camera,
  Server,
  Cpu,
  HardDrive,
  Activity,
  Radio,
  Layers,
  ArrowDownUp,
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

  return (
    <div>
      {/* ── 3D System Architecture Banner ── */}
      {currentMod === 'system' && (
        <div className="status-banner-3d">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.25) 0%, rgba(56,189,248,0.25) 100%)',
                    border: '1px solid rgba(99,102,241,0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--c)',
                    boxShadow: '0 0 16px rgba(99,102,241,0.2)'
                  }}
                >
                  <Server size={22} strokeWidth={2.2} />
                </div>
                <div>
                  <h3 style={{ margin: 0, color: 'var(--fg)', fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em' }}>
                    Operating System Core Architecture & Hardware Sentinel
                  </h3>
                  <span className="dim" style={{ fontSize: 11 }}>
                    Direct kernel metrics from native procfs, Windows CIM instances, and non-blocking psutil hooks
                  </span>
                </div>
                <Badge v="KERNEL AUDIT" tone="g" />
              </div>

              <p className="dim" style={{ fontSize: 12.5, margin: '6px 0 0', maxWidth: 740, lineHeight: 1.5 }}>
                Direct low-overhead hardware telemetry extracted via kernel procfs (<code style={{ color: 'var(--c)' }}>/proc/stat</code>, <code style={{ color: 'var(--c)' }}>/proc/meminfo</code>, <code style={{ color: 'var(--c)' }}>/proc/uptime</code>) and Windows Management Instrumentation.
                Monitors system health, multi-core workload distribution, and physical memory saturation.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
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
                  fontWeight: 600
                }}
                title="Auto-refresh hardware telemetry every 4 seconds"
              >
                <Radio size={13} className={liveAuto ? 'spin' : ''} />
                <span>{liveAuto ? 'Live Telemetry: ON' : 'Live Telemetry: OFF'}</span>
              </button>

              <span className="badge p" style={{ fontSize: 11, padding: '3px 10px' }}>
                Platform: {src.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <Btn onClick={run} loading={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Scan {currentMod}
        </Btn>
        {currentMod === 'system' && (
          <Btn onClick={history} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Camera size={14} /> Show Snapshots
          </Btn>
        )}
        <span className="dim" style={{ marginLeft: 'auto', fontSize: 12 }}>
          {rows.length} telemetry records available
        </span>
      </div>

      <ErrorBox error={error || err} errors={data?.errors} />

      {data?.alerts.map((a, i) => (
        <div key={i} style={{ marginBottom: 6 }}>
          <Badge v={a.severity} tone={a.severity === 'HIGH' || a.severity === 'CRITICAL' ? 'r' : 'y'} /> {a.message}
        </div>
      ))}

      {/* ── System Gauges & Hardware Cards (Strictly retains cpu_pct for Vitest) ── */}
      {sys && (
        <div className="grid" style={{ marginBottom: 16 }}>
          <Card className="card-3d" title="CPU & Memory Utilization">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 0' }}>
              <Bar label="cpu_pct" v={parseFloat(sys.cpu_pct || 0)} />
              <Bar label="ram_pct" v={parseFloat(sys.ram_pct || 0)} />
              <Bar label="disk_pct" v={parseFloat(sys.disk_pct || 0)} />
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
            sub="Total active host run time"
          />

          <Stat
            label="Network I/O"
            value={sys.net_rx !== undefined && sys.net_rx !== '' ? `${Math.round(Number(sys.net_rx) / 1024)} KB RX` : 'Active'}
            sub={sys.net_tx !== undefined && sys.net_tx !== '' ? `${Math.round(Number(sys.net_tx) / 1024)} KB TX` : 'Telemetry linked'}
          />
        </div>
      )}

      {/* ── 4 Holographic System Resource Health Cards ── */}
      {currentMod === 'system' && sys && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 16 }}>
          <Card className="card-3d" style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span className="dim" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>Processor Engine</span>
              <Cpu size={16} color="var(--c)" />
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: Number(sys.cpu_pct || 0) > 75 ? 'var(--r)' : 'var(--g)' }}>
              {sys.cpu_pct || 0}%
            </div>
            <div className="dim" style={{ fontSize: 11 }}>Active Processing Workload</div>
          </Card>

          <Card className="card-3d" style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span className="dim" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>RAM Saturation</span>
              <Activity size={16} color="var(--p)" />
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: Number(sys.ram_pct || 0) > 85 ? 'var(--r)' : 'var(--c)' }}>
              {sys.ram_pct || 0}%
            </div>
            <div className="dim" style={{ fontSize: 11 }}>Allocated System Memory</div>
          </Card>

          <Card className="card-3d" style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span className="dim" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>Root Disk Storage</span>
              <HardDrive size={16} color="var(--g)" />
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: Number(sys.disk_pct || 0) > 90 ? 'var(--r)' : 'var(--fg)' }}>
              {sys.disk_pct || 0}%
            </div>
            <div className="dim" style={{ fontSize: 11 }}>FileSystem Partition Space</div>
          </Card>

          <Card className="card-3d" style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span className="dim" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>Kernel Pipeline</span>
              <ArrowDownUp size={16} color="var(--a)" />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--g)', marginTop: 4 }}>
              Active Stream
            </div>
            <div className="dim" style={{ fontSize: 11 }}>Real telemetry from {sys.source}</div>
          </Card>
        </div>
      )}

      {/* ── Structured Data Table ── */}
      <Card
        className="card-3d"
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Layers size={16} color="var(--c)" />
            <span>Raw Kernel Telemetry Diagnostic Records</span>
          </span>
        }
      >
        <Table rows={data?.rows} />
      </Card>

      {/* ── Saved Snapshots Drawer ── */}
      {snaps && (
        <div style={{ marginTop: 16 }}>
          <Card className="card-3d" title="Saved snapshots (Live Monitor > Snapshot)">
            <Table rows={snaps} />
          </Card>
        </div>
      )}
    </div>
  )
}
