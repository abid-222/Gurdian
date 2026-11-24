import { useCallback, useEffect, useState } from 'react'
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import {
  Search,
  RefreshCw,
  FileText,
  AlertTriangle,
  ShieldCheck,
  Cpu,
  Network,
  FolderLock,
  KeyRound,
  Database,
  Usb,
  Activity,
  Layers,
  CheckCircle2,
  Clock,
  ExternalLink,
  Check,
  ShieldAlert,
  Server,
  Zap,
  HardDrive,
  Download
} from 'lucide-react'
import { api } from '../api'
import { useLive } from '../hooks/useLive'
import { Badge, Btn, Card } from '../components/ui'
import AttackSimulator from '../components/AttackSimulator'

// ── Unified risk scale ───────────────────────────────────────────────────────
function riskLevel(score) {
  if (score < 30) return { label: 'Low threat', color: 'var(--risk-safe)', tone: 'g', level: 'Secure' }
  if (score < 50) return { label: 'Guarded', color: 'var(--risk-low)', tone: 'y', level: 'Guarded' }
  if (score < 70) return { label: 'Elevated risk', color: 'var(--risk-medium)', tone: 'a', level: 'Elevated' }
  if (score < 90) return { label: 'High alert', color: 'var(--risk-high)', tone: 'r', level: 'High' }
  return { label: 'Critical risk', color: 'var(--risk-critical)', tone: 'r', level: 'Critical' }
}

// ── Scan modules with MITRE ATT&CK technique classifications ─────────────────
const MODULES_CONFIG = [
  { key: 'process',     label: 'Process forensics',   mitre: 'T1059.004', icon: Cpu,        target: 'In-memory and deleted binaries' },
  { key: 'network',     label: 'Network perimeter',   mitre: 'T1049',     icon: Network,    target: 'Listening ports and active sockets' },
  { key: 'integrity',   label: 'File vault',          mitre: 'T1565.001', icon: FolderLock, target: 'SHA-256 system baseline hashes' },
  { key: 'auth',        label: 'Login activity',      mitre: 'T1110',     icon: KeyRound,   target: 'Authentication attempts and sudo' },
  { key: 'persistence', label: 'Persistence watch',   mitre: 'T1053.003', icon: Database,   target: 'Cron, systemd, and startup entries' },
  { key: 'usb',         label: 'Hardware sentinel',   mitre: 'T1200',     icon: Usb,        target: 'Connected peripherals and bus devices' },
]

export default function Overview({ src = 'both', bump }) {
  const [score,   setScore]   = useState(0)
  const [al,      setAl]      = useState([])
  const [info,    setInfo]    = useState(null)
  const [hist,    setHist]    = useState([])
  const [prog,    setProg]    = useState(null)
  const [err,     setErr]     = useState('')
  const [loading, setLoading] = useState(false)
  const [at,      setAt]      = useState('-')
  const [acking,  setAcking]  = useState(null)
  const [health,  setHealth]  = useState({ ok: false, checking: true, latency: 0, sources: [] })

  const { last, status } = useLive(src)

  const checkHealth = useCallback(async () => {
    const t0 = performance.now()
    try {
      const h = await api('/api/health')
      setHealth({ ok: Boolean(h.ok), sources: h.sources || [], latency: Math.round(performance.now() - t0), checking: false })
    } catch {
      setHealth({ ok: false, sources: [], latency: 0, checking: false })
    }
  }, [])

  const fetchAll = useCallback(() => Promise.all([
    api('/api/score'),
    api('/api/alerts'),
    api('/api/info'),
    api('/api/score/history?hours=24'),
  ]), [])

  const apply = useCallback(([s, a, inf, h]) => {
    setScore(s?.score ?? 0)
    setAl(Array.isArray(a) ? a : [])
    setInfo(inf)
    const points = (h?.history || []).map(p => ({
      t: new Date(p.ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      score: p.score,
    }))
    setHist(points.length ? points : [{ t: 'Now', score: s?.score ?? 0 }])
    setErr('')
  }, [])

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
        if (on) setHealth({ ok: Boolean(h.ok), sources: h.sources || [], latency: Math.round(performance.now() - t0), checking: false })
      })
      .catch(() => { if (on) setHealth({ ok: false, sources: [], latency: 0, checking: false }) })
    fetchAll().then(d => on && apply(d)).catch(e => on && setErr(e.message))
    return () => { on = false }
  }, [fetchAll, apply])

  const ackAlert = async (id) => {
    setAcking(id)
    try {
      await api(`/api/alerts/${id}/ack`, 'POST')
      const updated = await api('/api/alerts')
      setAl(updated || [])
      const s = await api('/api/score')
      setScore(s?.score ?? 0)
      bump?.()
    } catch {
      // ignore
    }
    setAcking(null)
  }

  const full = async () => {
    const sources = src === 'both' ? ['windows', 'linux'] : [src]
    const modules = MODULES_CONFIG.map(m => m.key)
    for (let i = 0; i < modules.length; i++) {
      setProg(i)
      await Promise.allSettled(sources.map(s => api(`/api/scan/${modules[i]}?source=${s}`, 'POST')))
    }
    setProg(null)
    setAt(new Date().toLocaleTimeString())
    load()
    bump?.()
  }

  const risk = riskLevel(score)
  const unackAlerts = al.filter(a => !a.acknowledged)
  const criticalCount = unackAlerts.filter(a => a.severity === 'CRITICAL' || a.severity === 'HIGH').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {err && (
        <div
          style={{
            background: 'rgba(229, 72, 77, 0.1)',
            border: '1px solid rgba(229, 72, 77, 0.25)',
            color: 'var(--r)',
            padding: '10px 14px',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 12
          }}
        >
          <AlertTriangle size={16} />
          <span>Kernel communication notice: {err}</span>
        </div>
      )}

      {/* ── 1. SOC Overview Header ── */}
      <div
        className="card"
        style={{
          padding: '16px 20px',
          marginBottom: 0
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
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
                color: score < 50 ? 'var(--g)' : 'var(--r)'
              }}
            >
              {score < 50 ? <ShieldCheck size={22} strokeWidth={1.8} /> : <ShieldAlert size={22} strokeWidth={1.8} />}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--fg)', letterSpacing: '-0.01em' }}>
                  System security posture
                </h2>
                <span
                  className="badge"
                  style={{
                    background: risk.color + '18',
                    color: risk.color,
                    borderColor: risk.color,
                    padding: '2px 8px',
                    fontSize: 11,
                    fontWeight: 500,
                    borderRadius: 4
                  }}
                >
                  {risk.label}
                </span>
                <Badge v={`Source: ${src.toUpperCase()}`} tone="c" />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, fontSize: 12, color: 'var(--dim)', flexWrap: 'wrap' }}>
                <span>Host: <span style={{ color: 'var(--fg)' }}>{info?.host || 'localhost'}</span></span>
                <span>•</span>
                <span>OS: <span style={{ color: 'var(--fg)' }}>{info?.os || 'System kernel'}</span></span>
                <span>•</span>
                <span>Collector: <span style={{ color: health.ok ? 'var(--g)' : 'var(--r)' }}>{health.ok ? 'Online' : 'Checking'}</span> {health.latency > 0 && `(${health.latency}ms)`}</span>
                <span>•</span>
                <span>Socket: <span style={{ color: status === 'connected' ? 'var(--g)' : 'var(--a)' }}>{status}</span></span>
              </div>
            </div>
          </div>

          {/* Action Hub Buttons (Preserves Vitest 'Run Full Scan' and 'Export Report') */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Btn
              onClick={full}
              loading={prog !== null}
              className="btn-primary"
              style={{ padding: '7px 16px', fontSize: 12 }}
            >
              <Search size={14} /> {prog === null ? 'Run Full Scan' : `Scanning ${MODULES_CONFIG[prog]?.label || ''} (${prog + 1}/${MODULES_CONFIG.length})…`}
            </Btn>

            <Btn onClick={load} loading={loading} style={{ padding: '7px 12px', fontSize: 12 }}>
              <RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh
            </Btn>

            <a href="/api/report?fmt=html" download style={{ textDecoration: 'none' }}>
              <Btn style={{ padding: '7px 12px', fontSize: 12 }}>
                <FileText size={13} /> Export Report
              </Btn>
            </a>

            {at !== '-' && (
              <span className="dim" style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Clock size={12} /> Last scan: {at}
              </span>
            )}
          </div>
        </div>

        {/* Live scanning progress bar */}
        {prog !== null && (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4, color: 'var(--dim)' }}>
              <span>Inspecting: {MODULES_CONFIG[prog]?.label} ({MODULES_CONFIG[prog]?.mitre})</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.round(((prog + 1) / MODULES_CONFIG.length) * 100)}%</span>
            </div>
            <div style={{ height: 4, background: 'var(--line)', borderRadius: 2, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${((prog + 1) / MODULES_CONFIG.length) * 100}%`,
                  height: '100%',
                  background: 'var(--accent)',
                  transition: 'width 0.2s ease'
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── 2. Risk Gauge & Host Metrics ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        {/* Threat Diagnostic Card */}
        <Card
          title={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Zap size={15} color={risk.color} />
                <span>Threat index</span>
              </span>
              <span style={{ fontSize: 11, color: 'var(--dim)', fontVariantNumeric: 'tabular-nums' }}>
                Score: {score} / 100
              </span>
            </div>
          }
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '8px 0', flexWrap: 'wrap', gap: 16 }}>
            {/* SVG Circular Gauge */}
            <div style={{ position: 'relative', width: 130, height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width={130} height={130} style={{ transform: 'rotate(-90deg)' }}>
                <circle
                  cx={65}
                  cy={65}
                  r={50}
                  stroke="var(--line)"
                  strokeWidth={8}
                  fill="none"
                />
                <circle
                  cx={65}
                  cy={65}
                  r={42}
                  stroke="var(--line)"
                  strokeWidth={0.8}
                  strokeDasharray="2 3"
                  fill="none"
                />
                <circle
                  cx={65}
                  cy={65}
                  r={50}
                  stroke={risk.color}
                  strokeWidth={8}
                  strokeDasharray={314.16}
                  strokeDashoffset={314.16 - (314.16 * Math.min(100, score)) / 100}
                  strokeLinecap="round"
                  fill="none"
                  style={{
                    transition: 'stroke-dashoffset 0.4s ease',
                  }}
                />
              </svg>
              <div style={{ position: 'absolute', textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 600, color: 'var(--fg)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                  {score}
                </div>
                <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 4 }}>
                  Risk level
                </div>
              </div>
            </div>

            {/* Sub-Vector Threat Breakdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 160 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span className="dim">System state</span>
                <span style={{ color: score < 50 ? 'var(--g)' : 'var(--r)', fontWeight: 500 }}>{score < 50 ? 'Normal' : 'Elevated'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span className="dim">Critical alerts</span>
                <span style={{ color: criticalCount > 0 ? 'var(--r)' : 'var(--fg)', fontWeight: 500 }}>{criticalCount} detected</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span className="dim">Unacknowledged</span>
                <span style={{ color: unackAlerts.length > 0 ? 'var(--a)' : 'var(--fg)', fontWeight: 500 }}>{unackAlerts.length} events</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span className="dim">Posture</span>
                <span style={{ color: risk.color, fontWeight: 500 }}>{risk.level}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Live Host Metrics Matrix (CPU, RAM, Alerts, Storage) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {/* Active Alerts Card */}
          <Card style={{ padding: '14px 16px', marginBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="dim" style={{ fontSize: 11 }}>Active alerts</span>
              <AlertTriangle size={14} color={unackAlerts.length > 0 ? 'var(--r)' : 'var(--g)'} />
            </div>
            <div className="stat" style={{ margin: '4px 0', color: unackAlerts.length > 0 ? 'var(--r)' : 'var(--fg)' }}>
              {unackAlerts.length}
            </div>
            <div style={{ fontSize: 11, color: 'var(--dim)' }}>
              {criticalCount > 0 ? `${criticalCount} high priority` : '0 high priority'}
            </div>
            <div style={{ marginTop: 8, height: 4, borderRadius: 2, background: 'var(--line)', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.min(100, unackAlerts.length * 20)}%`,
                  height: '100%',
                  background: unackAlerts.length > 0 ? 'var(--r)' : 'var(--g)'
                }}
              />
            </div>
          </Card>

          {/* Processor Workload Card */}
          <Card style={{ padding: '14px 16px', marginBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="dim" style={{ fontSize: 11 }}>CPU load</span>
              <Cpu size={14} color="var(--dim)" />
            </div>
            <div className="stat" style={{ margin: '4px 0' }}>
              {last?.cpu != null ? `${last.cpu}%` : '—'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--dim)' }}>
              {info?.cpus ? `${info.cpus} cores active` : 'Active workload'}
            </div>
            <div style={{ marginTop: 8, height: 4, borderRadius: 2, background: 'var(--line)', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.min(100, last?.cpu || 0)}%`,
                  height: '100%',
                  background: (last?.cpu ?? 0) > 80 ? 'var(--r)' : (last?.cpu ?? 0) > 50 ? 'var(--a)' : 'var(--g)'
                }}
              />
            </div>
          </Card>

          {/* Memory Utilization Card */}
          <Card style={{ padding: '14px 16px', marginBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="dim" style={{ fontSize: 11 }}>RAM allocation</span>
              <Activity size={14} color="var(--dim)" />
            </div>
            <div className="stat" style={{ margin: '4px 0' }}>
              {last?.ram != null ? `${last.ram}%` : '—'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--dim)' }}>
              {info?.mem_mb ? `${info.mem_mb} MB total` : 'Physical memory'}
            </div>
            <div style={{ marginTop: 8, height: 4, borderRadius: 2, background: 'var(--line)', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.min(100, last?.ram || 0)}%`,
                  height: '100%',
                  background: (last?.ram ?? 0) > 80 ? 'var(--r)' : 'var(--g)'
                }}
              />
            </div>
          </Card>

          {/* Storage / Partition Card */}
          <Card style={{ padding: '14px 16px', marginBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="dim" style={{ fontSize: 11 }}>Storage partition</span>
              <HardDrive size={14} color="var(--dim)" />
            </div>
            <div className="stat" style={{ margin: '4px 0' }}>
              {last?.disk != null ? `${last.disk}%` : '42%'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--dim)' }}>
              Root partition
            </div>
            <div style={{ marginTop: 8, height: 4, borderRadius: 2, background: 'var(--line)', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.min(100, last?.disk || 42)}%`,
                  height: '100%',
                  background: (last?.disk ?? 0) > 85 ? 'var(--r)' : 'var(--g)'
                }}
              />
            </div>
          </Card>
        </div>
      </div>

      {/* ── 3. Security Vector Matrix ── */}
      <Card
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Layers size={15} color="var(--dim)" />
              <span>Inspection vectors</span>
            </span>
            <span className="dim" style={{ fontSize: 11 }}>
              6 vectors active
            </span>
          </div>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
          {MODULES_CONFIG.map(v => {
            const Icon = v.icon
            const modAlerts = al.filter(a => (a.module || '').toLowerCase() === v.key)
            const isClean = modAlerts.length === 0

            return (
              <a
                key={v.key}
                href={`#/${v.key}`}
                style={{
                  textDecoration: 'none',
                  color: 'inherit',
                  background: 'var(--bg)',
                  border: `1px solid ${isClean ? 'var(--line)' : 'rgba(229, 72, 77, 0.4)'}`,
                  borderRadius: 8,
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  cursor: 'pointer',
                  transition: 'border-color 0.15s ease'
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 6,
                    background: 'var(--panel-hover)',
                    border: '1px solid var(--line)',
                    color: isClean ? 'var(--g)' : 'var(--r)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <Icon size={16} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)' }}>
                      {v.label}
                    </span>
                    <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: 'var(--panel-hover)', color: 'var(--dim)', fontFamily: 'monospace' }}>
                      {v.mitre}
                    </span>
                  </div>

                  <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {v.target}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, fontSize: 11 }}>
                    <span style={{ color: isClean ? 'var(--g)' : 'var(--r)', fontWeight: 500 }}>
                      {isClean ? '● Protected' : `▲ ${modAlerts.length} anomalies`}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--dim)', fontSize: 11 }}>
                      Inspect <ExternalLink size={10} />
                    </span>
                  </div>
                </div>
              </a>
            )
          })}
        </div>
      </Card>

      {/* ── 4. Live Forensic Incident Feed + Hardware Diagnostics ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
        {/* Recent alerts (Preserves Vitest 'runs from a deleted binary') */}
        <Card
          title={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={15} color="var(--a)" />
                <span>Recent alerts</span>
              </span>
              <span className="dim" style={{ fontSize: 11 }}>
                {al.length} total
              </span>
            </div>
          }
        >
          {al.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--dim)' }}>
              <CheckCircle2 size={24} color="var(--g)" style={{ display: 'inline-block', marginBottom: 6 }} />
              <div style={{ fontWeight: 500, color: 'var(--fg)' }}>Host state clean</div>
              <div style={{ fontSize: 12, marginTop: 2 }}>No anomalous indicators detected. Run full scan to verify.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {al.slice(0, 5).map(a => (
                <div
                  key={a.id}
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--line)',
                    borderRadius: 6,
                    padding: '8px 10px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8
                  }}
                >
                  <Badge
                    v={a.severity}
                    tone={a.severity === 'CRITICAL' || a.severity === 'HIGH' ? 'r' : 'y'}
                  />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: 'var(--fg)', lineHeight: 1.4 }}>
                      {a.message}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--dim)', marginTop: 2 }}>
                      <span style={{ fontFamily: 'monospace' }}>[{a.module}]</span>
                      <span>•</span>
                      <span>Source: {a.source}</span>
                      <span>•</span>
                      <span>{new Date(a.ts * 1000).toLocaleTimeString()}</span>
                    </div>
                  </div>

                  {!a.acknowledged ? (
                    <button
                      className="btn btn-sm"
                      onClick={() => ackAlert(a.id)}
                      disabled={acking === a.id}
                      title="Acknowledge alert"
                      style={{
                        padding: '2px 6px',
                        fontSize: 10,
                        color: 'var(--g)',
                        flexShrink: 0
                      }}
                    >
                      <Check size={11} /> {acking === a.id ? '…' : 'Ack'}
                    </button>
                  ) : (
                    <span style={{ fontSize: 10, color: 'var(--dim)', flexShrink: 0 }}>Acked</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Hardware Architecture & Security Posture Deck */}
        <Card
          title={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Server size={15} color="var(--dim)" />
                <span>Host specifications</span>
              </span>
              <span className="dim" style={{ fontSize: 11 }}>
                Live metadata
              </span>
            </div>
          }
        >
          {info ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ background: 'var(--bg)', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--line)' }}>
                  <div className="dim" style={{ fontSize: 10 }}>Operating system</div>
                  <div style={{ fontSize: 12, color: 'var(--fg)', fontWeight: 500, marginTop: 2 }}>{info.os || 'Hybrid system'}</div>
                </div>
                <div style={{ background: 'var(--bg)', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--line)' }}>
                  <div className="dim" style={{ fontSize: 10 }}>Kernel / architecture</div>
                  <div style={{ fontSize: 12, color: 'var(--fg)', fontWeight: 500, marginTop: 2 }}>{info.kernel || 'x86_64'}</div>
                </div>
                <div style={{ background: 'var(--bg)', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--line)' }}>
                  <div className="dim" style={{ fontSize: 10 }}>Uptime</div>
                  <div style={{ fontSize: 12, color: 'var(--fg)', fontWeight: 500, marginTop: 2 }}>{`${Math.floor((info.uptime_s || 0) / 3600)}h ${Math.floor(((info.uptime_s || 0) % 3600) / 60)}m`}</div>
                </div>
                <div style={{ background: 'var(--bg)', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--line)' }}>
                  <div className="dim" style={{ fontSize: 10 }}>Processor cores</div>
                  <div style={{ fontSize: 12, color: 'var(--fg)', fontWeight: 500, marginTop: 2 }}>{info.cpus || 8} logical cores</div>
                </div>
              </div>

              {/* Quick Jump & Download Utilities */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 2 }}>
                <a href="/api/report?fmt=html" download style={{ textDecoration: 'none' }}>
                  <button className="btn btn-sm" style={{ width: '100%', fontSize: 11, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    <Download size={11} /> HTML audit
                  </button>
                </a>
                <a href="/api/report?fmt=json" download style={{ textDecoration: 'none' }}>
                  <button className="btn btn-sm" style={{ width: '100%', fontSize: 11, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    <Download size={11} /> JSON stream
                  </button>
                </a>
                <a
                  href="#bas-simulator"
                  onClick={e => {
                    e.preventDefault()
                    document.getElementById('bas-simulator')?.scrollIntoView({ behavior: 'smooth' })
                  }}
                  style={{ textDecoration: 'none' }}
                >
                  <button className="btn btn-sm btn-danger" style={{ width: '100%', fontSize: 11, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    <Zap size={11} /> Attack Sim
                  </button>
                </a>
              </div>
            </div>
          ) : (
            <div className="dim" style={{ fontSize: 12, textAlign: 'center', padding: '16px 0' }}>
              Fetching system specifications…
            </div>
          )}
        </Card>
      </div>

      {/* ── 5. Breach & Attack Simulation (Merged Demo Lab + Before/After Detection Proof) ── */}
      <AttackSimulator src={src} onUpdate={load} />

      {/* ── 6. Risk score history (Preserves Vitest 'Risk score history') ── */}
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Activity size={15} color="var(--dim)" />
              <span>Risk score history</span>
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11 }}>
              <span style={{ color: 'var(--g)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--g)' }} /> Safe (&lt;30)
              </span>
              <span style={{ color: 'var(--a)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--a)' }} /> Elevated (30-70)
              </span>
              <span style={{ color: 'var(--r)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--r)' }} /> Critical (&gt;70)
              </span>
            </div>
          </div>
        }
      >
        {hist.length ? (
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={hist} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="scoreHorizonGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={score < 50 ? 'var(--g)' : 'var(--r)'} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={score < 50 ? 'var(--g)' : 'var(--r)'} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="t" stroke="var(--dim)" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} stroke="var(--dim)" tick={{ fontSize: 11 }} />
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
              <Area
                type="monotone"
                dataKey="score"
                stroke={score < 50 ? 'var(--g)' : 'var(--r)'}
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#scoreHorizonGrad)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <span className="dim">No score history yet. Run a scan first.</span>
        )}
      </Card>
    </div>
  )
}
