import { useState } from 'react'
import { api } from '../api'
import { useScan } from '../hooks/useScan'
import { Badge, Bar, Btn, Card, ErrorBox, Stat, Table } from '../components/ui'

export default function Generic({ mod, src }) {
  const { data, loading, error, run } = useScan(mod, src)
  const [snaps, setSnaps] = useState(null)
  const [err, setErr] = useState('')

  const history = async () => {
    try {
      const res = await api(`/api/history/${mod}`)
      setSnaps((res.snapshots || []).map(x => ({ ...x, ts: new Date(x.ts * 1000).toLocaleString() })))
      setErr('')
    } catch (e) {
      setErr(e.message)
    }
  }

  const sys = mod === 'system' && data?.rows?.[0] ? data.rows[0] : null

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <Btn onClick={run} loading={loading}>Scan {mod}</Btn>
        {mod === 'system' && <Btn onClick={history}>Show Snapshots</Btn>}
      </div>

      <ErrorBox error={error || err} errors={data?.errors} />
      {data?.alerts.map((a, i) => (
        <div key={i}><Badge v={a.severity} /> {a.message}</div>
      ))}

      {/* System gauges and cards for visual look */}
      {sys && (
        <div className="grid">
          <Card title="CPU & Memory">
            <Bar label="cpu_pct" v={parseFloat(sys.cpu_pct || 0)} />
            <Bar label="ram_pct" v={parseFloat(sys.ram_pct || 0)} />
            <Bar label="disk_pct" v={parseFloat(sys.disk_pct || 0)} />
          </Card>
          <Stat label="CPU Load Avg" value={sys.load1 || sys.cpu_pct || '-'} sub={`source: ${sys.source}`} />
          <Stat label="Uptime" value={sys.uptime_s ? `${Math.floor(sys.uptime_s / 3600)}h ${Math.floor((sys.uptime_s % 3600) / 60)}m` : '-'} sub="Total active run time" />
          <Stat label="Network I/O" value={sys.net_rx !== undefined ? `${Math.round(sys.net_rx / 1024)} KB RX` : '-'} sub={sys.net_tx !== undefined ? `${Math.round(sys.net_tx / 1024)} KB TX` : ''} />
        </div>
      )}

      {/* Structured data table */}
      <Table rows={data?.rows} />

      {snaps && (
        <Card title="Saved snapshots (Live Monitor > Snapshot)">
          <Table rows={snaps} />
        </Card>
      )}
    </div>
  )
}
