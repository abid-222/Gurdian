import { useState } from 'react'
import { FileCheck2, Save, Hash, Download, Plus, ArrowRight, ShieldAlert, CheckCircle2 } from 'lucide-react'
import { api, saveBaseline, toCsv } from '../api'
import { useScan } from '../hooks/useScan'
import { Badge, Btn, Card, ErrorBox, Table } from '../components/ui'

export default function FileVault({ src }) {
  const { data, loading, error, run } = useScan('integrity', src)
  const [full, setFull] = useState(false)
  const [path, setPath] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const h = x => (x ? (full ? x : x.slice(0, 12) + '…') : '-')
  const rawRows = data?.rows || []
  const rows = rawRows.map(r => ({
    source: r.source,
    path: r.path,
    status: r.status || 'NO BASELINE',
    hash: h(r.sha256),
    baseline: h(r.baseline_sha256),
  }))
  const changed = rawRows.filter(r => r.status === 'CHANGED')
  const intact = rawRows.filter(r => r.status === 'OK' || r.status === 'KNOWN' || r.status === 'INTACT')
  const noBaseline = rawRows.filter(r => !r.status || r.status === 'NO BASELINE')

  const act = async (f, ok) => {
    try {
      await f()
      setMsg(ok)
      setErr('')
      run()
    } catch (e) {
      setErr(e.message)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <FileCheck2 size={18} color="var(--accent)" />
              <h3 style={{ margin: 0, color: 'var(--fg)', fontSize: 16, fontWeight: 600 }}>
                File integrity vault
              </h3>
              <Badge v={changed.length > 0 ? `${changed.length} CHANGED` : 'Intact'} tone={changed.length > 0 ? 'r' : 'g'} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 11, color: 'var(--dim)', marginTop: 4 }}>
              <span>1. Compute SHA-256</span>
              <ArrowRight size={11} />
              <span>2. Compare vs Saved Baseline</span>
              <ArrowRight size={11} />
              <span style={{ color: 'var(--r)' }}>3. Flag Tampered Files (CHANGED)</span>
            </div>
          </div>
          <Btn variant="primary" onClick={() => act(() => saveBaseline('integrity', src), 'Baseline saved')}>
            <Save size={14} /> Save Baseline
          </Btn>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid" style={{ marginBottom: 0 }}>
        <Card title="Monitored Files" style={{ marginBottom: 0 }}>
          <div className="stat" style={{ color: 'var(--c)' }}>{rows.length}</div>
          <span className="dim">Critical OS &amp; watchlist files</span>
        </Card>
        <Card title="Verified Intact" style={{ marginBottom: 0 }}>
          <div className="stat" style={{ color: 'var(--g)' }}>{intact.length}</div>
          <span className="dim">SHA-256 matches saved baseline</span>
        </Card>
        <Card title="Tampered / No Baseline" style={{ marginBottom: 0 }}>
          <div className="stat" style={{ color: changed.length > 0 ? 'var(--r)' : 'var(--a)' }}>
            {changed.length} / {noBaseline.length}
          </div>
          <span className="dim">{changed.length > 0 ? 'Hash mismatch detected!' : 'Click Save Baseline to lock hashes'}</span>
        </Card>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Btn onClick={run} loading={loading}><FileCheck2 size={14} /> Verify Files</Btn>
        <Btn on={full} onClick={() => setFull(!full)}><Hash size={14} /> Show Hash</Btn>
        <Btn onClick={() => toCsv(data?.rows, 'files.csv')} disabled={!data?.rows?.length}><Download size={14} /> Export</Btn>
        {msg && (
          <span style={{ color: 'var(--g)', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
            <CheckCircle2 size={13} /> {msg}
          </span>
        )}
      </div>

      {/* Watchlist Form */}
      <Card style={{ marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <input
            className="in"
            placeholder="/absolute/path/to/file or C:\path\to\file"
            value={path}
            onChange={e => setPath(e.target.value)}
            style={{ flex: 1, minWidth: 260 }}
          />
          <Btn onClick={() => act(() => api('/api/watch', 'POST', { path }), `Watching ${path}`)} disabled={!path}>
            <Plus size={14} /> Add File to Watch
          </Btn>
        </div>
      </Card>

      <ErrorBox error={error || err} errors={data?.errors} />

      {/* Tampered Alert Cards */}
      {changed.map(r => (
        <Card key={r.path} title={`CHANGED: ${r.path}`} style={{ borderLeft: '4px solid var(--r)', marginBottom: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 14px', fontSize: 12 }}>
            <span className="dim">Baseline SHA-256:</span>
            <code>{r.baseline_sha256}</code>
            <span className="dim" style={{ color: 'var(--r)' }}>Current SHA-256:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <code style={{ color: 'var(--r)', fontWeight: 'bold' }}>{r.sha256}</code>
              <Badge v="HIGH" />
              <ShieldAlert size={14} color="var(--r)" />
            </div>
          </div>
        </Card>
      ))}

      <Table rows={rows} cols={['source', 'path', 'status', 'hash', 'baseline']} />
    </div>
  )
}
