import { useState } from 'react'
import { FileCheck2, Save, Hash, Download, Plus } from 'lucide-react'
import { api, toCsv } from '../api'
import { useScan } from '../hooks/useScan'
import { Badge, Btn, Card, ErrorBox, Table } from '../components/ui'

export default function FileVault({ src }) {
  const { data, loading, error, run } = useScan('integrity', src)
  const [full, setFull] = useState(false)
  const [path, setPath] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const h = x => (x ? (full ? x : x.slice(0, 12) + '…') : '-')
  const rows = (data?.rows || []).map(r => ({
    source: r.source,
    path: r.path,
    status: r.status || 'NO BASELINE',
    hash: h(r.sha256),
    baseline: h(r.baseline_sha256)
  }))
  const changed = (data?.rows || []).filter(r => r.status === 'CHANGED')

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
    <div>
      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <Btn onClick={run} loading={loading}>
          <FileCheck2 size={14} /> Verify Files
        </Btn>
        <Btn
          onClick={() =>
            act(
              () =>
                Promise.all(
                  (src === 'both' ? ['linux', 'windows'] : [src]).map(s =>
                    api(`/api/baseline/integrity?source=${s}`, 'POST')
                  )
                ),
              'Baseline saved'
            )
          }
        >
          <Save size={14} /> Save Baseline
        </Btn>
        <Btn on={full} onClick={() => setFull(!full)}>
          <Hash size={14} /> Show Hash
        </Btn>
        <Btn onClick={() => toCsv(data?.rows, 'files.csv')} disabled={!data?.rows.length}>
          <Download size={14} /> Export
        </Btn>
        <span className="dim" style={{ marginLeft: 'auto', fontSize: 12 }}>
          {rows.length} monitored files {msg && `· ${msg}`}
        </span>
      </div>

      {/* ── Watchlist Form ── */}
      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <input
            className="in"
            placeholder="/absolute/path/to/file"
            value={path}
            onChange={e => setPath(e.target.value)}
            style={{ flex: 1, minWidth: 260 }}
          />
          <Btn
            onClick={() => act(() => api('/api/watch', 'POST', { path }), `Watching ${path}`)}
            disabled={!path}
          >
            <Plus size={14} /> Add File to Watch
          </Btn>
        </div>
      </Card>

      <ErrorBox error={error || err} errors={data?.errors} />

      {/* ── Tampered / Changed Alert Cards ── */}
      {changed.map(r => (
        <Card key={r.path} title={`CHANGED: ${r.path}`} style={{ borderLeft: '4px solid var(--r)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 14px', fontSize: 12 }}>
            <span className="dim">Baseline:</span>
            <code>{r.baseline_sha256}</code>
            <span className="dim" style={{ color: 'var(--r)' }}>Current SHA-256:</span>
            <div>
              <code style={{ color: 'var(--r)', fontWeight: 'bold' }}>{r.sha256}</code>
              &nbsp;&nbsp;<Badge v="HIGH" />
            </div>
          </div>
        </Card>
      ))}

      {/* ── Watched Files Table ── */}
      <Table rows={rows} cols={['source', 'path', 'status', 'hash', 'baseline']} />
    </div>
  )
}
