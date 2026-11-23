import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Search, ShieldAlert, Users, ListFilter, Clock } from 'lucide-react'
import { useScan } from '../hooks/useScan'
import { Badge, Btn, Card, ErrorBox, Table } from '../components/ui'

const RANGE = { '1h': [3600e3, 300e3], '24h': [864e5, 3600e3], '7d': [6048e5, 864e5] }

const bucket = (rows, r, now) => {
  const [span, step] = RANGE[r]
  const n = Math.ceil(span / step)
  const b = Array.from({ length: n }, (_, i) => ({
    t: new Date(now - (n - 1 - i) * step).toLocaleString([], r === '7d' ? { month: 'short', day: 'numeric' } : { hour: '2-digit', minute: '2-digit' }),
    failed: 0
  }))
  rows.forEach(x => {
    if (x.result !== 'FAILED') return
    const age = now - new Date(x.ts).getTime()
    if (age >= 0 && age < span) b[n - 1 - Math.floor(age / step)].failed++
  })
  return b
}

const top = (rows, k) =>
  Object.entries(
    rows.reduce((m, r) => {
      m[r[k]] = (m[r[k]] || 0) + 1
      return m
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

export default function Auth({ src }) {
  const { data, loading, error, limited, run } = useScan('auth', src)
  const [r, setR] = useState('24h')
  const [view, setView] = useState('events')

  const span = RANGE[r][0]
  const now = data ? new Date(data.started_at).getTime() : 0
  const rows = (data?.rows || []).filter(x => x.method === 'session' || (x.ts && now - new Date(x.ts).getTime() < span))
  const failed = rows.filter(x => x.result === 'FAILED')
  const sessions = rows.filter(x => x.method === 'session')
  const byIp = top(failed, 'source_ip').map(([ip, n]) => ({ source_ip: ip, failed: String(n) }))

  return (
    <div>
      {/* ── 3D Security Module Banner ── */}
      <div className="status-banner-3d">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <ShieldAlert size={22} color="var(--c)" />
              <h3 style={{ margin: 0, color: 'var(--fg)', fontSize: 16 }}>
                Authentication & Privilege Escalation Sentinel
              </h3>
              <Badge v={failed.length > 0 ? `${failed.length} FAILED ATTEMPTS` : 'SECURE'} tone={failed.length > 0 ? 'a' : 'g'} />
            </div>
            <p className="dim" style={{ fontSize: 13, margin: '4px 0 0', maxWidth: 740, lineHeight: 1.5 }}>
              Audits PAM authentication logs, SSH logins, and sudo execution records.
              Employs behavioral sliding windows to detect brute-force password cracking attacks and rogue user sessions.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="badge c" style={{ fontSize: 11, padding: '4px 10px' }}>
              Active Sessions: {sessions.length}
            </span>
          </div>
        </div>
      </div>

      {/* ── Action Toolbar ── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <Btn onClick={run} loading={loading}>
          <Search size={14} /> Check Logins
        </Btn>
        <Btn on={view === 'ip'} onClick={() => setView('ip')}>
          <ShieldAlert size={14} /> Failed Logins by IP
        </Btn>
        <Btn on={view === 'users'} onClick={() => setView('users')}>
          <Users size={14} /> Current Users
        </Btn>
        <Btn on={view === 'events'} onClick={() => setView('events')}>
          <ListFilter size={14} /> All Events
        </Btn>

        <div style={{ display: 'inline-flex', gap: 4, marginLeft: 'auto', background: 'rgba(0,0,0,0.25)', padding: '2px 4px', borderRadius: 8, border: '1px solid var(--line)' }}>
          <span className="dim" style={{ padding: '0 6px', fontSize: 11, alignSelf: 'center' }}>
            <Clock size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Range:
          </span>
          {Object.keys(RANGE).map(k => (
            <Btn key={k} on={r === k} onClick={() => setR(k)} style={{ margin: 0, padding: '2px 8px', fontSize: 11 }}>
              {k}
            </Btn>
          ))}
        </div>
      </div>

      {limited && (
        <div style={{ marginBottom: 10 }}>
          <Badge v="LIMITED MODE" tone="a" />
        </div>
      )}

      <ErrorBox error={error} errors={data?.errors} />

      {data?.alerts.map((a, i) => (
        <div key={i} style={{ marginBottom: 6 }}>
          <Badge v={a.severity} /> {a.message}
        </div>
      ))}

      {/* ── Histogram Card ── */}
      <Card title={`Failed logins over time (${r})`}>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={bucket(failed, r, now)}>
            <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
            <XAxis dataKey="t" stroke="var(--dim)" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} stroke="var(--dim)" tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--fg)' }} />
            <Bar dataKey="failed" fill="var(--r)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* ── Top 5 Offenders Grid ── */}
      <div className="grid">
        <Card title="Top 5 source IPs">
          {top(failed, 'source_ip').map(([k, n]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--line-light)' }}>
              <span>{k}</span> <b style={{ color: 'var(--r)' }}>{n} failed</b>
            </div>
          ))}
          {top(failed, 'source_ip').length === 0 && <span className="dim">No failed IP attempts recorded.</span>}
        </Card>
        <Card title="Top 5 usernames">
          {top(failed, 'username').map(([k, n]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--line-light)' }}>
              <span>{k}</span> <b style={{ color: 'var(--a)' }}>{n} targets</b>
            </div>
          ))}
          {top(failed, 'username').length === 0 && <span className="dim">No targeted usernames recorded.</span>}
        </Card>
      </div>

      {/* ── Event Table ── */}
      {view === 'ip' ? (
        <Table rows={byIp} />
      ) : view === 'users' ? (
        <Table rows={sessions} cols={['source', 'username', 'source_ip', 'ts']} />
      ) : (
        <Table rows={rows} cols={['source', 'ts', 'username', 'source_ip', 'result', 'method']} />
      )}
    </div>
  )
}
