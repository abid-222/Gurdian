import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useScan } from '../hooks/useScan'
import { Badge, Btn, Card, ErrorBox, Table } from '../components/ui'
const RANGE = { '1h': [3600e3, 300e3], '24h': [864e5, 3600e3], '7d': [6048e5, 864e5] }
const bucket = (rows, r, now) => { const [span, step] = RANGE[r], n = Math.ceil(span / step)
  const b = Array.from({ length: n }, (_, i) => ({ t: new Date(now - (n - 1 - i) * step).toLocaleString([], r === '7d' ? { month: 'short', day: 'numeric' } : { hour: '2-digit', minute: '2-digit' }), failed: 0 }))
  rows.forEach(x => { if (x.result !== 'FAILED') return; const age = now - new Date(x.ts).getTime(); if (age >= 0 && age < span) b[n - 1 - Math.floor(age / step)].failed++ }); return b }
const top = (rows, k) => Object.entries(rows.reduce((m, r) => (m[r[k]] = (m[r[k]] || 0) + 1, m), {})).sort((a, b) => b[1] - a[1]).slice(0, 5)
export default function Auth({ src }) {
  const { data, loading, error, limited, run } = useScan('auth', src), [r, setR] = useState('24h'), [view, setView] = useState('events')
  const span = RANGE[r][0], now = data ? new Date(data.started_at).getTime() : 0   // server scan time, same clock as the log timestamps
  const rows = (data?.rows || []).filter(x => x.method === 'session' || (x.ts && now - new Date(x.ts).getTime() < span))
  const failed = rows.filter(x => x.result === 'FAILED'), sessions = rows.filter(x => x.method === 'session')
  const byIp = top(failed, 'source_ip').map(([ip, n]) => ({ source_ip: ip, failed: String(n) }))
  return <div><Btn onClick={run} loading={loading}>Check Logins</Btn><Btn on={view === 'ip'} onClick={() => setView('ip')}>Failed Logins by IP</Btn><Btn on={view === 'users'} onClick={() => setView('users')}>Current Users</Btn><Btn on={view === 'events'} onClick={() => setView('events')}>All Events</Btn>
    {Object.keys(RANGE).map(k => <Btn key={k} on={r === k} onClick={() => setR(k)}>{k}</Btn>)}{limited && <Badge v="LIMITED MODE" tone="a" />}<ErrorBox error={error} errors={data?.errors} />{data?.alerts.map((a, i) => <div key={i}><Badge v={a.severity} /> {a.message}</div>)}
    <Card title={`Failed logins over time (${r})`}><ResponsiveContainer width="100%" height={150}><BarChart data={bucket(failed, r, now)}><CartesianGrid stroke="#223041" /><XAxis dataKey="t" stroke="#6e7f91" /><YAxis allowDecimals={false} stroke="#6e7f91" /><Tooltip contentStyle={{ background: '#111821' }} /><Bar dataKey="failed" fill="#f85149" /></BarChart></ResponsiveContainer></Card>
    <div className="grid"><Card title="Top 5 source IPs">{top(failed, 'source_ip').map(([k, n]) => <div key={k}>{k} <b>{n}</b></div>)}</Card><Card title="Top 5 usernames">{top(failed, 'username').map(([k, n]) => <div key={k}>{k} <b>{n}</b></div>)}</Card></div>
    {view === 'ip' ? <Table rows={byIp} /> : view === 'users' ? <Table rows={sessions} cols={['source', 'username', 'source_ip', 'ts']} /> : <Table rows={rows} cols={['source', 'ts', 'username', 'source_ip', 'result', 'method']} />}</div>
}
