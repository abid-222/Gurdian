import { useState } from 'react'
import { Search, Save, Filter } from 'lucide-react'
import { api } from '../api'
import { useScan } from '../hooks/useScan'
import { Badge, Btn, Card, ErrorBox } from '../components/ui'

export default function Persistence({ src }) {
  const { data, loading, error, run } = useScan('persistence', src)
  const [onlyNew, setOnlyNew] = useState(false)
  const [err, setErr] = useState('')

  const rows = (data?.rows || []).filter(r => !onlyNew || r.status === 'NEW')
  const groups = rows.reduce((m, r) => {
    ;(m[r.type] ||= []).push(r)
    return m
  }, {})

  const save = async () => {
    try {
      await Promise.all(
        (src === 'both' ? ['linux', 'windows'] : [src]).map(s =>
          api(`/api/baseline/persistence?source=${s}`, 'POST')
        )
      )
      run()
    } catch (e) {
      setErr(e.message)
    }
  }

  return (
    <div>
      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <Btn onClick={run} loading={loading}>
          <Search size={14} /> Hunt Persistence
        </Btn>
        <Btn onClick={save}>
          <Save size={14} /> Save Baseline
        </Btn>
        <Btn on={onlyNew} onClick={() => setOnlyNew(!onlyNew)}>
          <Filter size={14} /> Show Only NEW
        </Btn>
        <span className="dim" style={{ marginLeft: 'auto', fontSize: 12 }}>
          {rows.length} autostart / hook entries detected
        </span>
      </div>

      <ErrorBox error={error || err} errors={data?.errors} />

      {data?.alerts.map((a, i) => (
        <div key={i} style={{ marginBottom: 6 }}>
          <Badge v={a.severity} /> {a.message}
        </div>
      ))}

      {/* ── Autostart Groups ── */}
      <div className="grid">
        {Object.entries(groups).map(([t, l]) => (
          <Card key={t} title={`${t} (${l.length})`}>
            {l.map((r, i) => (
              <div
                key={i}
                style={{
                  padding: '8px 0',
                  borderBottom: i < l.length - 1 ? '1px solid var(--line-light)' : 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Badge v={r.source} />
                  {r.status === 'NEW' && <Badge v="NEW" />}
                  <span style={{ fontWeight: 600, wordBreak: 'break-all', fontSize: 12 }}>
                    {r.location}
                  </span>
                </div>
                <div className="dim" style={{ fontSize: 11 }}>
                  first seen {r.first_seen || '-'}
                </div>
              </div>
            ))}
          </Card>
        ))}
      </div>

      {!rows.length && !loading && (
        <Card>
          <p className="dim" style={{ margin: 0, textAlign: 'center', padding: '16px' }}>
            Nothing to show.
          </p>
        </Card>
      )}
    </div>
  )
}
