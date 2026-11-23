import { useCallback, useEffect, useState } from 'react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
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

export default function Overview({ src, bump }) {
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

  const apply = useCallback(([s, a, i, h]) => {
    setScore(s.score)
    setAl(a)
    setInfo(i)
    setHist(h.map(x => ({
      t: new Date(x.ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      score: x.score
    })))
    setErr('')
    bump?.()
  }, [bump])

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
    const sources = src === 'both' ? ['linux', 'windows'] : [src]
    for (let i = 0; i < MODULES.length; i++) {
      setProg(i)
      await Promise.all(sources.map(s => api(`/api/scan/${MODULES[i]}?source=${s}`, 'POST').catch(() => {})))
    }
    setProg(null)
    setAt(new Date().toLocaleTimeString())
    load()
  }

  const risk = riskLevel(score)
  const unackAlerts = al.filter(a => !a.acknowledged).length

  return (
    <div>
      {err && <p className="err">✖ {err}</p>}

      {/* ── Service health row ─────────────────────────────────────────── */}
      <Card style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              width: 10, height: 10, borderRadius: '50%',
              background: health.checking ? 'var(--a)' : health.ok ? 'var(--g)' : 'var(--r)',
              display: 'inline-block', flexShrink: 0
            }} />
            <span><b>guardian-api.service</b></span>
            <Badge v={health.ok ? 'ONLINE' : 'OFFLINE'} tone={health.ok ? 'g' : 'r'} />
            {health.latency > 0 && <span className="dim">{health.latency} ms</span>}
          </div>
          <div className="dim" style={{ fontSize: '0.85em' }}>
            Collectors: {health.sources?.length ? health.sources.join(', ') : 'detecting…'}
            &nbsp;·&nbsp;WebSocket: {status}
            {info && <>&nbsp;·&nbsp;Host: <b>{info.host}</b></>}
          </div>
        </div>
      </Card>

      {/* ── Action bar ────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <Btn onClick={full} loading={prog !== null}>
          {prog === null ? 'Run Full Scan' : `Scanning ${MODULES[prog]} (${prog + 1}/${MODULES.length})…`}
        </Btn>
        <Btn onClick={load} loading={loading}>Refresh</Btn>
        <a href="/api/report?fmt=html" download>
          <Btn>Export Report</Btn>
        </a>
        {at !== '-' && (
          <span className="dim" style={{ marginLeft: 'auto', fontSize: '0.85em' }}>
            last scan: {at}
          </span>
        )}
      </div>

      {/* ── Top row: 4 stat cards ─────────────────────────────────────── */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', marginBottom: 12 }}>
        {/* Risk score gauge card */}
        <Card title="Risk Score">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <Gauge score={score} size={120} />
            <span style={{ color: risk.color, fontWeight: 700, fontSize: '0.9em' }}>{risk.label}</span>
          </div>
        </Card>

        {/* Active alerts */}
        <Card title="Active Alerts">
          <div className="stat" style={{ color: unackAlerts > 0 ? 'var(--r)' : 'var(--g)' }}>
            {unackAlerts}
          </div>
          <span className="dim">{al.length} total</span>
        </Card>

        {/* CPU */}
        <Card title="CPU %">
          <div className="stat" style={{ color: (last?.cpu ?? 0) > 80 ? 'var(--r)' : (last?.cpu ?? 0) > 50 ? 'var(--a)' : 'var(--g)' }}>
            {last ? `${last.cpu}%` : '—'}
          </div>
          <span className="dim">{src} · live</span>
        </Card>

        {/* RAM */}
        <Card title="RAM %">
          <div className="stat" style={{ color: (last?.ram ?? 0) > 80 ? 'var(--r)' : (last?.ram ?? 0) > 50 ? 'var(--a)' : 'var(--g)' }}>
            {last ? `${last.ram}%` : '—'}
          </div>
          <span className="dim">{last ? `disk ${last.disk}%` : 'live stream'}</span>
        </Card>
      </div>

      {/* ── Second row: Recent Alerts + Quick Actions ──────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        {/* Recent alerts */}
        <Card title="Recent Alerts">
          {al.length === 0 ? (
            <span className="dim">No alerts. Run a scan to populate.</span>
          ) : (
            al.slice(0, 5).map(a => (
              <div key={a.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                padding: '8px 0', borderBottom: '1px solid rgba(128,128,128,0.12)'
              }}>
                <Badge v={a.severity} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.88em', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {a.message}
                  </div>
                  <div className="dim" style={{ fontSize: '0.78em' }}>
                    {a.module} / {a.source}
                  </div>
                </div>
              </div>
            ))
          )}
        </Card>

        {/* Quick actions */}
        <Card title="Quick Actions">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Btn onClick={full} loading={prog !== null} style={{ width: '100%' }}>
              {prog === null ? '🔍  Run Full Scan' : `Scanning ${MODULES[prog]} (${prog + 1}/${MODULES.length})…`}
            </Btn>
            <Btn onClick={load} loading={loading} style={{ width: '100%' }}>
              🔄  Refresh Dashboard
            </Btn>
            <a href="/api/report?fmt=html" download style={{ display: 'block' }}>
              <Btn style={{ width: '100%' }}>📄  Export HTML Report</Btn>
            </a>
            <a href="/api/report?fmt=json" download style={{ display: 'block' }}>
              <Btn style={{ width: '100%' }}>📦  Export JSON Report</Btn>
            </a>
          </div>

          {/* System info (brief) */}
          {info && (
            <div style={{ marginTop: 16, fontSize: '0.85em', lineHeight: 1.8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0 12px' }}>
                <span className="dim">OS</span>       <span>{info.os || '—'}</span>
                <span className="dim">Kernel</span>   <span>{info.kernel || '—'}</span>
                <span className="dim">Uptime</span>   <span>{`${Math.floor(info.uptime_s / 3600)}h ${Math.floor((info.uptime_s % 3600) / 60)}m`}</span>
                <span className="dim">CPUs</span>     <span>{info.cpus} logical cores</span>
                <span className="dim">Memory</span>   <span>{info.mem_mb} MB total</span>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* ── Third row: Risk score history chart ───────────────────────── */}
      <Card title="Risk Score History (24 h)">
        {hist.length ? (
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={hist}>
              <XAxis dataKey="t" stroke="var(--dim, #7982a9)" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} stroke="var(--dim, #7982a9)" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: 'var(--panel, #1a1b2e)',
                  border: '1px solid var(--line, rgba(255,255,255,0.1))',
                  color: 'var(--fg, #cdd6f4)',
                  borderRadius: 6
                }}
              />
              {/* Threshold reference lines rendered as annotations */}
              <Line type="stepAfter" dataKey="score" stroke="var(--r, #ef2929)" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <span className="dim">No score history yet. Run a scan first.</span>
        )}
      </Card>
    </div>
  )
}
