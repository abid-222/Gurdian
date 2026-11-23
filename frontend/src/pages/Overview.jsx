import { useCallback, useEffect, useState } from 'react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  Search,
  RefreshCw,
  FileText,
  Code2,
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
  Clock
} from 'lucide-react'
import { api } from '../api'
import { useLive } from '../hooks/useLive'
import { Badge, Btn, Card, Gauge } from '../components/ui'

// ── Unified risk scale ───────────────────────────────────────────────────────
function riskLevel(score) {
  if (score < 30) return { label: 'SAFE',     color: 'var(--g)' }
  if (score < 50) return { label: 'LOW',      color: '#a3e635' }
  if (score < 70) return { label: 'MEDIUM',   color: 'var(--a)' }
  if (score < 90) return { label: 'HIGH',     color: '#f97316' }
  return             { label: 'CRITICAL', color: 'var(--r)' }
}

// ── Scan modules ─────────────────────────────────────────────────────────────
const MODULES = ['process', 'network', 'integrity', 'persistence', 'usb', 'auth']

export default function Overview({ src = 'both', bump }) {
  const [score,   setScore]   = useState(0)
  const [al,      setAl]      = useState([])
  const [info,    setInfo]    = useState(null)
  const [hist,    setHist]    = useState([])
  const [prog,    setProg]    = useState(null)   // null | index 0-5
  const [err,     setErr]     = useState('')
  const [loading, setLoading] = useState(false)
  const [at,      setAt]      = useState('-')
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
    setHist((h?.history || []).map(p => ({
      t: new Date(p.ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      score: p.score,
    })))
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

  // ── Full scan ───────────────────────────────────────────────────────────
  const full = async () => {
    const sources = src === 'both' ? ['windows', 'linux'] : [src]
    for (let i = 0; i < MODULES.length; i++) {
      setProg(i)
      await Promise.allSettled(sources.map(s => api(`/api/scan/${MODULES[i]}?source=${s}`, 'POST')))
    }
    setProg(null)
    setAt(new Date().toLocaleTimeString())
    load()
    bump?.()
  }

  const risk = riskLevel(score)
  const unackAlerts = al.filter(a => !a.acknowledged).length

  // Vector counts for status matrix
  const vectorIcons = {
    process: Cpu,
    network: Network,
    integrity: FolderLock,
    auth: KeyRound,
    persistence: Database,
    usb: Usb
  }

  const vectorStats = MODULES.map(m => {
    const count = al.filter(a => (a.module || '').toLowerCase() === m).length
    return {
      key: m,
      label: m === 'integrity' ? 'File Vault' : (m.charAt(0).toUpperCase() + m.slice(1)),
      icon: vectorIcons[m] || Activity,
      count,
      status: count === 0 ? 'CLEAN' : `${count} ANOMALY`
    }
  })

  return (
    <div>
      {err && (
        <p className="err" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={14} /> {err}
        </p>
      )}

      {/* ── 3D Live Cyber Command Center Banner ── */}
      <div className="status-banner-3d" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 12,
                background: 'linear-gradient(135deg, rgba(16,185,129,0.25) 0%, rgba(56,189,248,0.25) 100%)',
                border: '1.5px solid rgba(16,185,129,0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--g)',
                boxShadow: '0 0 20px rgba(16,185,129,0.3), inset 0 1px 0 rgba(255,255,255,0.2)'
              }}
            >
              <ShieldCheck size={26} strokeWidth={2.4} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: 18, color: 'var(--fg)', letterSpacing: '-0.02em', fontWeight: 800 }}>
                  Smart OS Guardian — 3D Cyber Command Center
                </h3>
                <Badge v={health.ok ? 'DAEMON ONLINE' : 'OFFLINE'} tone={health.ok ? 'g' : 'r'} />
                <Badge v={`MODE: ${src.toUpperCase()}`} tone="p" />
              </div>
              <p className="dim" style={{ margin: '4px 0 0', fontSize: 12.5, lineHeight: 1.4 }}>
                Connected Host: <b>{info?.host || 'DESKTOP-VT8JB92'}</b> · OS: <b>{info?.os || 'Windows/Linux Hybrid'}</b> · WebSocket: <b>{status}</b> {health.latency > 0 && `(${health.latency}ms ping)`}
              </p>
            </div>
          </div>

          {/* Action buttons (Strictly preserves Vitest 'Run Full Scan' and 'Export Report') */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Btn onClick={full} loading={prog !== null} className="btn-primary" style={{ padding: '8px 16px', fontWeight: 600 }}>
              <Search size={14} /> {prog === null ? 'Run Full Scan' : `Scanning ${MODULES[prog]} (${prog + 1}/${MODULES.length})…`}
            </Btn>
            <Btn onClick={load} loading={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
            </Btn>
            <a href="/api/report?fmt=html" download style={{ textDecoration: 'none' }}>
              <Btn style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
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
      </div>

      {/* ── Top row: 4 3D Holographic Stat Cards ── */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 16 }}>
        {/* Risk score gauge card */}
        <Card className="card-3d" title="Risk Score" style={{ padding: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '4px 0' }}>
            <Gauge score={score} size={130} />
            <span
              style={{
                color: risk.color,
                fontWeight: 800,
                fontSize: '1em',
                background: risk.color + '18',
                padding: '2px 10px',
                borderRadius: 12,
                border: `1px solid ${risk.color}40`
              }}
            >
              {risk.label} ({score}/100)
            </span>
          </div>
        </Card>

        {/* Active alerts */}
        <Card className="card-3d" title="Active Alerts" style={{ padding: 14 }}>
          <div className="stat" style={{ color: unackAlerts > 0 ? 'var(--r)' : 'var(--g)', fontSize: 28, fontWeight: 800 }}>
            {unackAlerts}
          </div>
          <span className="dim" style={{ fontSize: 11.5, marginTop: 4, display: 'block' }}>
            {al.length} total forensic events recorded
          </span>
          <div style={{ marginTop: 8, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.min(100, unackAlerts * 20)}%`,
                height: '100%',
                background: unackAlerts > 0 ? 'var(--r)' : 'var(--g)'
              }}
            />
          </div>
        </Card>

        {/* CPU */}
        <Card className="card-3d" title="CPU %" style={{ padding: 14 }}>
          <div
            className="stat"
            style={{
              color: (last?.cpu ?? 0) > 80 ? 'var(--r)' : (last?.cpu ?? 0) > 50 ? 'var(--a)' : 'var(--g)',
              fontSize: 28,
              fontWeight: 800
            }}
          >
            {last?.cpu != null ? `${last.cpu}%` : '—'}
          </div>
          <span className="dim" style={{ fontSize: 11.5, marginTop: 4, display: 'block' }}>
            Active Kernel Workload ({src.toUpperCase()})
          </span>
          <div style={{ marginTop: 8, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.min(100, last?.cpu || 0)}%`,
                height: '100%',
                background: (last?.cpu ?? 0) > 80 ? 'var(--r)' : (last?.cpu ?? 0) > 50 ? 'var(--a)' : 'var(--g)'
              }}
            />
          </div>
        </Card>

        {/* RAM */}
        <Card className="card-3d" title="RAM %" style={{ padding: 14 }}>
          <div
            className="stat"
            style={{
              color: (last?.ram ?? 0) > 80 ? 'var(--r)' : (last?.ram ?? 0) > 50 ? 'var(--a)' : 'var(--c)',
              fontSize: 28,
              fontWeight: 800
            }}
          >
            {last?.ram != null ? `${last.ram}%` : '—'}
          </div>
          <span className="dim" style={{ fontSize: 11.5, marginTop: 4, display: 'block' }}>
            {last?.disk != null ? `Root Storage Disk: ${last.disk}%` : 'Physical Memory Allocation'}
          </span>
          <div style={{ marginTop: 8, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.min(100, last?.ram || 0)}%`,
                height: '100%',
                background: (last?.ram ?? 0) > 80 ? 'var(--r)' : 'var(--c)'
              }}
            />
          </div>
        </Card>
      </div>

      {/* ── 6 Security Vectors Live Sentinel Deck ── */}
      <Card
        className="card-3d"
        style={{ marginBottom: 16 }}
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Layers size={16} color="var(--c)" />
              <span>Multi-Vector Security Sentinel Matrix</span>
            </span>
            <span className="dim" style={{ fontSize: 11, fontWeight: 400 }}>
              6 Vectors Inspected Concurrently
            </span>
          </div>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          {vectorStats.map(v => {
            const Icon = v.icon
            const isClean = v.count === 0
            return (
              <div
                key={v.key}
                style={{
                  background: 'var(--panel-2, rgba(255,255,255,0.02))',
                  border: '1px solid var(--line)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    background: isClean ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)',
                    border: `1px solid ${isClean ? 'rgba(16,185,129,0.3)' : 'rgba(244,63,94,0.3)'}`,
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
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {v.label}
                  </div>
                  <div style={{ fontSize: 10, color: isClean ? 'var(--g)' : 'var(--r)', fontWeight: 600 }}>
                    {isClean ? 'PASSED' : `${v.count} DEFICIENCY`}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* ── Second row: Recent Alerts + Quick Actions ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginBottom: 16 }}>
        {/* Recent alerts (Strictly preserves Vitest seen('runs from a deleted binary')) */}
        <Card className="card-3d" title="Recent Alerts">
          {al.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--dim)', fontSize: 12 }}>
              <CheckCircle2 size={28} color="var(--g)" style={{ display: 'inline-block', marginBottom: 6 }} />
              <div>No alerts detected. Run a full scan to populate.</div>
            </div>
          ) : (
            al.slice(0, 5).map(a => (
              <div
                key={a.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '10px 0',
                  borderBottom: '1px solid var(--line)'
                }}
              >
                <Badge v={a.severity} tone={a.severity === 'HIGH' || a.severity === 'CRITICAL' ? 'r' : 'y'} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.9em', fontWeight: 600, color: 'var(--fg)', lineHeight: 1.4 }}>
                    {a.message}
                  </div>
                  <div className="dim" style={{ fontSize: '0.8em', marginTop: 3 }}>
                    [{a.module}] · Source: {a.source} · {new Date(a.ts * 1000).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))
          )}
        </Card>

        {/* Quick actions & Machine Hardware Specs */}
        <Card className="card-3d" title="Quick Actions & Hardware Architecture">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
            <Btn onClick={full} loading={prog !== null} style={{ justifyContent: 'center' }}>
              <Search size={14} /> Full Scan
            </Btn>
            <Btn onClick={load} loading={loading} style={{ justifyContent: 'center' }}>
              <RefreshCw size={14} /> Refresh
            </Btn>
            <a href="/api/report?fmt=html" download style={{ textDecoration: 'none' }}>
              <Btn style={{ width: '100%', justifyContent: 'center' }}>
                <FileText size={14} /> HTML Report
              </Btn>
            </a>
            <a href="/api/report?fmt=json" download style={{ textDecoration: 'none' }}>
              <Btn style={{ width: '100%', justifyContent: 'center' }}>
                <Code2 size={14} /> JSON Report
              </Btn>
            </a>
          </div>

          {/* System info (brief) */}
          {info && (
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12, fontSize: '0.85em', lineHeight: 1.8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 14px' }}>
                <span className="dim">Platform OS</span>   <span><b>{info.os || 'Windows/Linux'}</b></span>
                <span className="dim">Kernel Arch</span>   <span>{info.kernel || 'x64'}</span>
                <span className="dim">Active Uptime</span> <span>{`${Math.floor(info.uptime_s / 3600)}h ${Math.floor((info.uptime_s % 3600) / 60)}m`}</span>
                <span className="dim">Processor Cores</span> <span>{info.cpus} logical cores</span>
                <span className="dim">RAM Capacity</span>  <span>{info.mem_mb} MB total</span>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* ── Third row: Risk score history chart (Matches Vitest seen('Risk score history')) ── */}
      <Card className="card-3d" title="Risk score history (24-Hour Behavioral Threat Horizon)">
        {hist.length ? (
          <ResponsiveContainer width="100%" height={170}>
            <LineChart data={hist}>
              <XAxis dataKey="t" stroke="var(--dim, #7982a9)" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} stroke="var(--dim, #7982a9)" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: 'var(--panel, #1a1b2e)',
                  border: '1px solid var(--line, rgba(255,255,255,0.1))',
                  color: 'var(--fg, #cdd6f4)',
                  borderRadius: 8
                }}
              />
              <Line type="stepAfter" dataKey="score" stroke="var(--r, #ef2929)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <span className="dim">No score history yet. Run a scan first.</span>
        )}
      </Card>
    </div>
  )
}
