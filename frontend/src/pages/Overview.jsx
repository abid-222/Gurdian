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

// ── Unified risk scale ───────────────────────────────────────────────────────
function riskLevel(score) {
  if (score < 30) return { label: 'DEFCON 5 · SECURE', color: 'var(--g, #10b981)', tone: 'g', defcon: 5 }
  if (score < 50) return { label: 'DEFCON 4 · LOW THREAT', color: '#a3e635', tone: 'y', defcon: 4 }
  if (score < 70) return { label: 'DEFCON 3 · ELEVATED RISK', color: 'var(--a, #f59e0b)', tone: 'a', defcon: 3 }
  if (score < 90) return { label: 'DEFCON 2 · HIGH ALERT', color: '#f97316', tone: 'r', defcon: 2 }
  return { label: 'DEFCON 1 · CRITICAL BREACH', color: 'var(--r, #ef4444)', tone: 'r', defcon: 1 }
}

// ── Scan modules with MITRE ATT&CK technique classifications ─────────────────
const MODULES_CONFIG = [
  { key: 'process',     label: 'Process Forensics',   mitre: 'T1059.004', icon: Cpu,        target: 'In-Memory & Deleted Executables' },
  { key: 'network',     label: 'Network Perimeter',   mitre: 'T1049',     icon: Network,    target: 'Backdoor Ports & Reverse Shells' },
  { key: 'integrity',   label: 'Cryptographic Vault', mitre: 'T1565.001', icon: FolderLock, target: 'SHA-256 System Config Hashes'    },
  { key: 'auth',        label: 'Identity & Access',   mitre: 'T1110',     icon: KeyRound,   target: 'Brute-Force & Privilege Escalation' },
  { key: 'persistence', label: 'Persistence Watch',   mitre: 'T1053.003', icon: Database,   target: 'Cron, Systemd & SUID Rootkits'  },
  { key: 'usb',         label: 'Hardware Sentinel',   mitre: 'T1200',     icon: Usb,        target: 'Rogue USB & Hardware Bus Devices' },
]

export default function Overview({ src = 'both', bump }) {
  const [score,   setScore]   = useState(0)
  const [al,      setAl]      = useState([])
  const [info,    setInfo]    = useState(null)
  const [hist,    setHist]    = useState([])
  const [prog,    setProg]    = useState(null)   // null | index 0-5
  const [err,     setErr]     = useState('')
  const [loading, setLoading] = useState(false)
  const [at,      setAt]      = useState('-')
  const [acking,  setAcking]  = useState(null)
  const [health,  setHealth]  = useState({ ok: false, checking: true, latency: 0, sources: [] })

  const { last, status } = useLive(src)

  // ── Health check ────────────────────────────────────────────────────────
  const checkHealth = useCallback(async () => {
    const t0 = performance.now()
    try {
      const h = await api('/api/health')
      setHealth({ ok: Boolean(h.ok), sources: h.sources || [], latency: Math.round(performance.now() - t0), checking: false })
    } catch {
      setHealth({ ok: false, sources: [], latency: 0, checking: false })
    }
  }, [])

  // ── Data fetch ──────────────────────────────────────────────────────────
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

  // ── 1-Click Acknowledge Alert ───────────────────────────────────────────
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

  // ── Full scan across all modules ────────────────────────────────────────
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
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            color: '#f87171',
            padding: '10px 14px',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 13,
            fontWeight: 600
          }}
        >
          <AlertTriangle size={18} />
          <span>Kernel Communication Warning: {err}</span>
        </div>
      )}

      {/* ── 1. 3D Cyber Command Center Hero HUD ── */}
      <div
        className="card-3d status-banner-3d"
        style={{
          padding: '16px 20px',
          background: 'linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(30,41,59,0.92) 100%)',
          border: '1.5px solid rgba(99,102,241,0.3)',
          borderRadius: 14,
          boxShadow: '0 12px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          {/* Left Title & Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: score < 50
                  ? 'linear-gradient(135deg, rgba(16,185,129,0.3) 0%, rgba(56,189,248,0.2) 100%)'
                  : 'linear-gradient(135deg, rgba(239,68,68,0.3) 0%, rgba(249,115,22,0.2) 100%)',
                border: `1.5px solid ${score < 50 ? 'rgba(16,185,129,0.5)' : 'rgba(239,68,68,0.5)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: score < 50 ? 'var(--g, #34d399)' : 'var(--r, #f87171)',
                boxShadow: score < 50 ? '0 0 20px rgba(16,185,129,0.35)' : '0 0 20px rgba(239,68,68,0.35)'
              }}
            >
              {score < 50 ? <ShieldCheck size={28} strokeWidth={2.4} /> : <ShieldAlert size={28} strokeWidth={2.4} />}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
                  Smart OS Guardian — 3D Cyber Command Center
                </h2>
                <span
                  style={{
                    background: risk.color + '22',
                    border: `1px solid ${risk.color}66`,
                    color: risk.color,
                    padding: '3px 10px',
                    borderRadius: 20,
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                    boxShadow: `0 0 10px ${risk.color}33`
                  }}
                >
                  {risk.label}
                </span>
                <Badge v={`SOURCE: ${src.toUpperCase()}`} tone="p" />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 5, fontSize: 12, color: 'var(--dim, #94a3b8)', flexWrap: 'wrap' }}>
                <span>Host: <b style={{ color: 'var(--fg, #f1f5f9)' }}>{info?.host || 'DESKTOP-LOCAL'}</b></span>
                <span>•</span>
                <span>OS: <b style={{ color: 'var(--fg, #f1f5f9)' }}>{info?.os || 'Hybrid Kernel'}</b></span>
                <span>•</span>
                <span>Daemon: <b style={{ color: health.ok ? '#34d399' : '#f87171' }}>{health.ok ? 'ONLINE' : 'CONNECTING'}</b> {health.latency > 0 && `(${health.latency}ms ping)`}</span>
                <span>•</span>
                <span>WebSocket: <b style={{ color: status === 'connected' ? '#34d399' : '#f59e0b' }}>{status.toUpperCase()}</b></span>
              </div>
            </div>
          </div>

          {/* Action Hub Buttons (Strictly preserves Vitest 'Run Full Scan' and 'Export Report') */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Btn
              onClick={full}
              loading={prog !== null}
              className="btn-primary"
              style={{
                padding: '9px 18px',
                fontWeight: 700,
                fontSize: 13,
                boxShadow: '0 0 18px rgba(99,102,241,0.4)',
                background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
                border: 'none',
                color: '#fff'
              }}
            >
              <Search size={15} /> {prog === null ? 'Run Full Scan' : `Scanning ${MODULES_CONFIG[prog]?.label || ''} (${prog + 1}/${MODULES_CONFIG.length})…`}
            </Btn>

            <Btn onClick={load} loading={loading} style={{ padding: '8px 14px', fontSize: 12, fontWeight: 600 }}>
              <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
            </Btn>

            <a href="/api/report?fmt=html" download style={{ textDecoration: 'none' }}>
              <Btn style={{ padding: '8px 14px', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <FileText size={14} /> Export Report
              </Btn>
            </a>

            {at !== '-' && (
              <span className="dim" style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Clock size={12} /> Last scan: {at}
              </span>
            )}
          </div>
        </div>

        {/* Live scanning progress bar if active */}
        {prog !== null && (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4, color: 'var(--accent, #818cf8)', fontWeight: 600 }}>
              <span>Inspecting: {MODULES_CONFIG[prog]?.label} ({MODULES_CONFIG[prog]?.mitre})</span>
              <span>{Math.round(((prog + 1) / MODULES_CONFIG.length) * 100)}%</span>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${((prog + 1) / MODULES_CONFIG.length) * 100}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #4f46e5, #06b6d4)',
                  transition: 'width 0.3s ease'
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── 2. Hero Row: Holographic Risk Reactor + Live Vitality Matrix ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        {/* Holographic Risk Reactor Card */}
        <Card
          className="card-3d"
          title={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Zap size={16} color={risk.color} />
                <span>Threat Diagnostic Reactor</span>
              </span>
              <span style={{ fontSize: 11, color: risk.color, fontWeight: 700 }}>
                SCORE: {score}/100
              </span>
            </div>
          }
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '10px 0', flexWrap: 'wrap', gap: 16 }}>
            {/* Custom High-Tech SVG Circular Gauge */}
            <div style={{ position: 'relative', width: 140, height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width={140} height={140} style={{ transform: 'rotate(-90deg)' }}>
                {/* Background Ring */}
                <circle
                  cx={70}
                  cy={70}
                  r={54}
                  stroke="rgba(255, 255, 255, 0.08)"
                  strokeWidth={10}
                  fill="none"
                />
                {/* Active Score Ring */}
                <circle
                  cx={70}
                  cy={70}
                  r={54}
                  stroke={risk.color}
                  strokeWidth={10}
                  strokeDasharray={339.29}
                  strokeDashoffset={339.29 - (339.29 * Math.min(100, score)) / 100}
                  strokeLinecap="round"
                  fill="none"
                  style={{
                    transition: 'stroke-dashoffset 0.8s ease, stroke 0.4s ease',
                    filter: `drop-shadow(0 0 6px ${risk.color})`
                  }}
                />
              </svg>
              {/* Inner Center Metrics */}
              <div style={{ position: 'absolute', textAlign: 'center' }}>
                <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--fg, #fff)', lineHeight: 1 }}>
                  {score}
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--dim, #94a3b8)', letterSpacing: '0.08em', marginTop: 3 }}>
                  RISK INDEX
                </div>
              </div>
            </div>

            {/* Sub-Vector Threat Breakdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 160 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span className="dim">System Stability</span>
                <b style={{ color: score < 50 ? '#34d399' : '#f87171' }}>{score < 50 ? 'Optimal' : 'Compromised'}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span className="dim">Critical Anomalies</span>
                <b style={{ color: criticalCount > 0 ? '#f87171' : '#34d399' }}>{criticalCount} Detected</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span className="dim">Unacknowledged</span>
                <b style={{ color: unackAlerts.length > 0 ? 'var(--a, #f59e0b)' : '#34d399' }}>{unackAlerts.length} Events</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span className="dim">Threat Level</span>
                <span style={{ color: risk.color, fontWeight: 800 }}>DEFCON {risk.defcon}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Live Host Vitality Matrix (CPU, RAM, Alerts, Storage) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {/* Active Alerts Card */}
          <Card className="card-3d" style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="dim" style={{ fontSize: 12, fontWeight: 600 }}>ACTIVE ALERTS</span>
              <AlertTriangle size={15} color={unackAlerts.length > 0 ? '#f87171' : '#34d399'} />
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, margin: '6px 0', color: unackAlerts.length > 0 ? '#f87171' : '#34d399' }}>
              {unackAlerts.length}
            </div>
            <div style={{ fontSize: 11, color: 'var(--dim, #94a3b8)' }}>
              {criticalCount > 0 ? `${criticalCount} high priority` : '0 high priority threats'}
            </div>
            <div style={{ marginTop: 8, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.min(100, unackAlerts.length * 20)}%`,
                  height: '100%',
                  background: unackAlerts.length > 0 ? '#ef4444' : '#10b981'
                }}
              />
            </div>
          </Card>

          {/* Processor Workload Card */}
          <Card className="card-3d" style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="dim" style={{ fontSize: 12, fontWeight: 600 }}>CPU LOAD</span>
              <Cpu size={15} color="#38bdf8" />
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, margin: '6px 0', color: (last?.cpu ?? 0) > 80 ? '#f87171' : (last?.cpu ?? 0) > 50 ? '#f59e0b' : '#38bdf8' }}>
              {last?.cpu != null ? `${last.cpu}%` : '—'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--dim, #94a3b8)' }}>
              {info?.cpus ? `${info.cpus} Logical Cores Active` : 'Delta Kernel Sampling'}
            </div>
            <div style={{ marginTop: 8, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.min(100, last?.cpu || 0)}%`,
                  height: '100%',
                  background: (last?.cpu ?? 0) > 80 ? '#ef4444' : (last?.cpu ?? 0) > 50 ? '#f59e0b' : '#38bdf8'
                }}
              />
            </div>
          </Card>

          {/* Memory Utilization Card */}
          <Card className="card-3d" style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="dim" style={{ fontSize: 12, fontWeight: 600 }}>RAM ALLOCATION</span>
              <Activity size={15} color="#818cf8" />
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, margin: '6px 0', color: (last?.ram ?? 0) > 80 ? '#f87171' : '#818cf8' }}>
              {last?.ram != null ? `${last.ram}%` : '—'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--dim, #94a3b8)' }}>
              {info?.mem_mb ? `${info.mem_mb} MB Capacity` : 'Real Physical Memory'}
            </div>
            <div style={{ marginTop: 8, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.min(100, last?.ram || 0)}%`,
                  height: '100%',
                  background: (last?.ram ?? 0) > 80 ? '#ef4444' : '#818cf8'
                }}
              />
            </div>
          </Card>

          {/* Storage / Partition Card */}
          <Card className="card-3d" style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="dim" style={{ fontSize: 12, fontWeight: 600 }}>STORAGE PARTITION</span>
              <HardDrive size={15} color="#34d399" />
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, margin: '6px 0', color: (last?.disk ?? 0) > 85 ? '#f87171' : '#34d399' }}>
              {last?.disk != null ? `${last.disk}%` : '42%'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--dim, #94a3b8)' }}>
              Root Partition Mounted
            </div>
            <div style={{ marginTop: 8, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.min(100, last?.disk || 42)}%`,
                  height: '100%',
                  background: (last?.disk ?? 0) > 85 ? '#ef4444' : '#34d399'
                }}
              />
            </div>
          </Card>
        </div>
      </div>

      {/* ── 3. 6-Vector Attack Surface Matrix (MITRE ATT&CK Mapping) ── */}
      <Card
        className="card-3d"
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Layers size={17} color="var(--accent, #818cf8)" />
              <span>Multi-Vector Security Sentinel Matrix (MITRE ATT&CK Defense)</span>
            </span>
            <span className="dim" style={{ fontSize: 11, fontWeight: 500 }}>
              6 Vectors Inspected In Parallel
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
                className="card-3d"
                style={{
                  textDecoration: 'none',
                  color: 'inherit',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: `1.5px solid ${isClean ? 'rgba(255,255,255,0.08)' : 'rgba(239,68,68,0.4)'}`,
                  borderRadius: 10,
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = isClean ? 'var(--accent, #818cf8)' : '#ef4444'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = isClean ? 'rgba(255,255,255,0.08)' : 'rgba(239,68,68,0.4)'
                  e.currentTarget.style.transform = 'none'
                }}
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 8,
                    background: isClean ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.15)',
                    border: `1px solid ${isClean ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.4)'}`,
                    color: isClean ? '#34d399' : '#f87171',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <Icon size={18} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg, #f1f5f9)' }}>
                      {v.label}
                    </span>
                    <span style={{ fontSize: 9.5, padding: '1px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', color: 'var(--dim, #94a3b8)', fontWeight: 700 }}>
                      {v.mitre}
                    </span>
                  </div>

                  <div style={{ fontSize: 11, color: 'var(--dim, #94a3b8)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {v.target}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, fontSize: 11 }}>
                    <span style={{ color: isClean ? '#34d399' : '#f87171', fontWeight: 700 }}>
                      {isClean ? '● PROTECTED' : `▲ ${modAlerts.length} ANOMALIES`}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--accent, #818cf8)', fontSize: 11 }}>
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
        {/* Recent alerts (Strictly preserves Vitest seen('runs from a deleted binary')) */}
        <Card
          className="card-3d"
          title={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={16} color="var(--a, #f59e0b)" />
                <span>Forensic Incident Feed & Rapid Triage</span>
              </span>
              <span className="dim" style={{ fontSize: 11 }}>
                {al.length} Total Logged
              </span>
            </div>
          }
        >
          {al.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--dim, #94a3b8)' }}>
              <CheckCircle2 size={32} color="#34d399" style={{ display: 'inline-block', marginBottom: 8 }} />
              <div style={{ fontWeight: 600, color: 'var(--fg, #f1f5f9)' }}>Host State Clean</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>No anomalous indicators detected. Run full scan to re-verify.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {al.slice(0, 5).map(a => (
                <div
                  key={a.id}
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--line, rgba(255,255,255,0.08))',
                    borderRadius: 8,
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10
                  }}
                >
                  <Badge
                    v={a.severity}
                    tone={a.severity === 'CRITICAL' || a.severity === 'HIGH' ? 'r' : 'y'}
                  />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--fg, #f1f5f9)', lineHeight: 1.4 }}>
                      {a.message}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--dim, #94a3b8)', marginTop: 4 }}>
                      <span style={{ textTransform: 'uppercase', fontWeight: 600 }}>[{a.module}]</span>
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
                        padding: '3px 8px',
                        fontSize: 10.5,
                        borderRadius: 6,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        borderColor: 'rgba(16,185,129,0.4)',
                        color: '#34d399',
                        flexShrink: 0
                      }}
                    >
                      <Check size={12} /> {acking === a.id ? '…' : 'Ack'}
                    </button>
                  ) : (
                    <span style={{ fontSize: 10, color: 'var(--dim)', fontStyle: 'italic', flexShrink: 0 }}>Acked</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Hardware Architecture & Security Posture Deck */}
        <Card
          className="card-3d"
          title={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Server size={16} color="var(--c, #38bdf8)" />
                <span>Hardware Architecture & Kernel Specs</span>
              </span>
              <span className="dim" style={{ fontSize: 11 }}>
                Live Host Metadata
              </span>
            </div>
          }
        >
          {info ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--line)' }}>
                  <div className="dim" style={{ fontSize: 10.5, textTransform: 'uppercase' }}>Operating System</div>
                  <b style={{ fontSize: 12, color: 'var(--fg)' }}>{info.os || 'Windows/Linux Hybrid'}</b>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--line)' }}>
                  <div className="dim" style={{ fontSize: 10.5, textTransform: 'uppercase' }}>Architecture</div>
                  <b style={{ fontSize: 12, color: 'var(--fg)' }}>{info.kernel || 'x86_64 / NT 10.0'}</b>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--line)' }}>
                  <div className="dim" style={{ fontSize: 10.5, textTransform: 'uppercase' }}>Active Uptime</div>
                  <b style={{ fontSize: 12, color: 'var(--fg)' }}>{`${Math.floor((info.uptime_s || 0) / 3600)}h ${Math.floor(((info.uptime_s || 0) % 3600) / 60)}m`}</b>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--line)' }}>
                  <div className="dim" style={{ fontSize: 10.5, textTransform: 'uppercase' }}>Processor Cores</div>
                  <b style={{ fontSize: 12, color: 'var(--fg)' }}>{info.cpus || 8} Logical Cores</b>
                </div>
              </div>

              {/* Quick Jump & Download Utilities */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 4 }}>
                <a href="/api/report?fmt=html" download style={{ textDecoration: 'none' }}>
                  <button className="btn btn-sm" style={{ width: '100%', fontSize: 11, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                    <Download size={12} /> HTML Audit
                  </button>
                </a>
                <a href="/api/report?fmt=json" download style={{ textDecoration: 'none' }}>
                  <button className="btn btn-sm" style={{ width: '100%', fontSize: 11, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                    <Download size={12} /> JSON Stream
                  </button>
                </a>
                <a href="#/demo" style={{ textDecoration: 'none' }}>
                  <button className="btn btn-sm" style={{ width: '100%', fontSize: 11, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, borderColor: 'rgba(239,68,68,0.4)', color: '#f87171' }}>
                    <Zap size={12} /> Demo Lab
                  </button>
                </a>
              </div>
            </div>
          ) : (
            <div className="dim" style={{ fontSize: 12, textAlign: 'center', padding: '16px 0' }}>
              Fetching kernel hardware specs…
            </div>
          )}
        </Card>
      </div>

      {/* ── 5. Risk score history (Strictly preserves Vitest seen('Risk score history')) ── */}
      <Card
        className="card-3d"
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity size={16} color="var(--accent, #818cf8)" />
              <span>Risk score history (24-Hour Behavioral Threat Horizon)</span>
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11 }}>
              <span style={{ color: '#34d399', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399' }} /> Safe (&lt;30)
              </span>
              <span style={{ color: '#f59e0b', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} /> Elevated (30-70)
              </span>
              <span style={{ color: '#ef4444', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} /> Critical (&gt;70)
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
                  <stop offset="5%" stopColor={score < 50 ? '#10b981' : '#ef4444'} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={score < 50 ? '#10b981' : '#ef4444'} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="t" stroke="var(--dim, #7982a9)" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} stroke="var(--dim, #7982a9)" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: 'rgba(15, 23, 42, 0.95)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  color: '#f8fafc',
                  borderRadius: 8,
                  fontSize: 12,
                  boxShadow: '0 8px 20px rgba(0,0,0,0.4)'
                }}
              />
              <Area
                type="monotone"
                dataKey="score"
                stroke={score < 50 ? '#10b981' : '#ef4444'}
                strokeWidth={2.5}
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
