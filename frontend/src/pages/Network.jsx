import { useState } from 'react'
import { Search, Save, Activity, Radio, Download, ArrowRight, AlertTriangle } from 'lucide-react'
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
  const newPorts = all.filter(r => r.status === 'NEW')

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Network Security Header */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Radio size={18} color="var(--accent)" />
              <h3 style={{ margin: 0, color: 'var(--fg)', fontSize: 16, fontWeight: 600 }}>
                Network perimeter
              </h3>
              <Badge v={newPorts.length > 0 ? `${newPorts.length} NEW PORT(S)` : `${listen.length} listening`} tone={newPorts.length > 0 ? 'r' : 'g'} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 11, color: 'var(--dim)', marginTop: 4 }}>
              <span>1. Scan Live TCP/UDP Sockets</span>
              <ArrowRight size={11} />
              <span>2. Compare vs Saved Port Baseline</span>
              <ArrowRight size={11} />
              <span style={{ color: 'var(--r)' }}>3. Flag Rogue Ports (NEW)</span>
            </div>
          </div>
          <Btn variant="primary" onClick={save} loading={busy}>
            <Save size={14} /> Save Baseline
          </Btn>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Btn onClick={run} loading={loading}><Search size={14} /> Scan Ports</Btn>
        <Btn on={conn} onClick={() => setConn(!conn)}><Activity size={14} /> Show Connections</Btn>
        <Btn on={radar} onClick={() => setRadar(!radar)}><Radio size={14} /> Radar {radar ? 'On' : 'Off'}</Btn>
        <Btn onClick={() => toCsv(all, 'network.csv')} disabled={!all.length}><Download size={14} /> Export CSV</Btn>
        <span className="dim" style={{ marginLeft: 'auto', fontSize: 12 }}>
          {listen.length} listening · {est.length} established {msg && `· ${msg}`}
        </span>
      </div>

      <ErrorBox error={error || err} errors={data?.errors} />

      {/* Highlighted Rogue / NEW Ports Banner */}
      {newPorts.length > 0 && (
        <div
          className="card"
          style={{
            marginBottom: 0,
            borderLeft: '4px solid var(--r)',
            background: 'rgba(229, 72, 77, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 12, color: 'var(--r)' }}>
            <AlertTriangle size={15} /> Unbaselined / Rogue Listening Ports Detected ({newPorts.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {newPorts.map((p, idx) => (
              <Badge key={idx} v={`NEW: ${p.proto} :${p.local_port} (${p.process || 'unknown'})`} tone="r" />
            ))}
          </div>
        </div>
      )}

      {data?.alerts.map((a, i) => (
        <div key={i} style={{ marginBottom: 2 }}>
          <Badge v={a.severity} /> {a.message}
        </div>
      ))}

      {/* Metrics Summary */}
      <div className="grid" style={{ marginBottom: 0 }}>
        <Card title="Listening Ports" style={{ marginBottom: 0 }}>
          <div className="stat" style={{ color: 'var(--g)' }}>{listen.length}</div>
          <span className="dim">Active services accepting connections</span>
        </Card>
        <Card title="Established Sockets" style={{ marginBottom: 0 }}>
          <div className="stat" style={{ color: 'var(--c)' }}>{est.length}</div>
          <span className="dim">Active remote network sessions</span>
        </Card>
        <Card title="Unbaselined (NEW)" style={{ marginBottom: 0 }}>
          <div className="stat" style={{ color: newPorts.length > 0 ? 'var(--r)' : 'var(--g)' }}>{newPorts.length}</div>
          <span className="dim">{newPorts.length > 0 ? 'Unexpected ports vs baseline' : `Source: ${src.toUpperCase()}`}</span>
        </Card>
      </div>

      <Card title="Connections per process (listening + established)" style={{ marginBottom: 0 }}>
        <Table rows={perProcess(all)} />
      </Card>

      {radar && (
        <Card title="Live Socket Geometry Radar (Port Range & Protocol Mapping)" style={{ marginBottom: 0 }}>
          <Radar rows={listen} />
        </Card>
      )}

      <Table
        rows={conn ? all : listen}
        cols={['source', 'proto', 'local_addr', 'local_port', 'state', 'process', 'remote_addr', 'status']}
      />
    </div>
  )
}
