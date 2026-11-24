import { useState } from 'react'
import { Search, Save, Activity, Radio, Download } from 'lucide-react'
import { saveBaseline, toCsv } from '../api'
import { useScan } from '../hooks/useScan'
import Radar from '../components/Radar'
import { Badge, Btn, Card, ErrorBox, Table } from '../components/ui'

const perProcess = rows =>
  Object.values(
    rows.reduce((m, r) => {
      const k = r.source + (r.process || '-')
      m[k] ||= { source: r.source, process: r.process || '-', listening: 0, established: 0 }
      m[k][r.state === 'LISTEN' ? 'listening' : 'established']++
      return m
    }, {})
  ).sort((a, b) => b.listening + b.established - a.listening - a.established)

export default function Network({ src }) {
  const { data, loading, error, run } = useScan('network', src)
  const [radar, setRadar] = useState(true)
  const [conn, setConn] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const all = data?.rows || []
  const listen = all.filter(r => r.state === 'LISTEN')
  const est = all.filter(r => r.state === 'ESTABLISHED')

  const save = async () => {
    setBusy(true)
    try {
      const r = await saveBaseline('network', src)
      setMsg(`Baseline saved (${r.reduce((a, x) => a + (x.saved || 0), 0)} ports)`)
      run()
    } catch (e) {
      setErr(e.message)
    }
    setBusy(false)
  }

  return (
    <div>
      {/* ── Network Security Header ── */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Radio size={18} color="var(--dim)" />
              <h3 style={{ margin: 0, color: 'var(--fg)', fontSize: 16, fontWeight: 600 }}>
                Network perimeter
              </h3>
              <Badge v={listen.length > 0 ? `${listen.length} listening` : 'Monitored'} tone="g" />
            </div>
            <p className="dim" style={{ fontSize: 12, margin: '4px 0 0', maxWidth: 740, lineHeight: 1.5 }}>
              Audits TCP/UDP sockets and remote connections. Flags unbaselined listening ports and maps active traffic per binary.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Badge v={`Established: ${est.length}`} tone="c" />
          </div>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <Btn onClick={run} loading={loading}>
          <Search size={14} /> Scan Ports
        </Btn>
        <Btn onClick={save} loading={busy}>
          <Save size={14} /> Save Baseline
        </Btn>
        <Btn on={conn} onClick={() => setConn(!conn)}>
          <Activity size={14} /> Show Connections
        </Btn>
        <Btn on={radar} onClick={() => setRadar(!radar)}>
          <Radio size={14} /> Radar {radar ? 'On' : 'Off'}
        </Btn>
        <Btn onClick={() => toCsv(all, 'network.csv')} disabled={!all.length}>
          <Download size={14} /> Export CSV
        </Btn>
        <span className="dim" style={{ marginLeft: 'auto', fontSize: 12 }}>
          {listen.length} listening · {est.length} established {msg && `· ${msg}`}
        </span>
      </div>

      <ErrorBox error={error || err} errors={data?.errors} />

      {/* ── Active scan alerts ── */}
      {data?.alerts.map((a, i) => (
        <div key={i} style={{ marginBottom: 6 }}>
          <Badge v={a.severity} /> {a.message}
        </div>
      ))}

      {/* ── Metrics Summary ── */}
      <div className="grid">
        <Card title="Listening Ports">
          <div className="stat" style={{ color: 'var(--g)' }}>{listen.length}</div>
          <span className="dim">Active services waiting for connection</span>
        </Card>
        <Card title="Established Sockets">
          <div className="stat" style={{ color: 'var(--c)' }}>{est.length}</div>
          <span className="dim">Active peer-to-peer network sessions</span>
        </Card>
        <Card title="Network Scope">
          <div className="stat">{src.toUpperCase()}</div>
          <span className="dim">Current collector inspection source</span>
        </Card>
      </div>

      {/* ── Connections Per Process ── */}
      <Card title="Connections per process (listening + established)">
        <Table rows={perProcess(all)} />
      </Card>

      {/* ── Geometric Socket Radar ── */}
      {radar && (
        <Card title="Live Socket Geometry Radar (Port Range & Protocol Mapping)">
          <Radar rows={listen} />
        </Card>
      )}

      {/* ── Raw Socket Table ── */}
      <div style={{ marginTop: 14 }}>
        <Table
          rows={conn ? all : listen}
          cols={['source', 'proto', 'local_addr', 'local_port', 'state', 'process', 'remote_addr', 'status']}
        />
      </div>
    </div>
  )
}
