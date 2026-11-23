import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, RefreshCw, Download, CheckCircle2 } from 'lucide-react'
import { api, toCsv } from '../api'
import { Badge, Btn, Card, ErrorBox } from '../components/ui'

const getMitreUrl = ref => {
  if (!ref) return null
  const m = String(ref).match(/T\d{4}(?:\.\d{3})?/)
  if (m) return `https://attack.mitre.org/techniques/${m[0].replace('.', '/')}`
  return `https://attack.mitre.org/wiki/Special:Search?search=${encodeURIComponent(ref)}`
}

export default function Alerts({ bump }) {
  const [al, setAl] = useState([])
  const [f, setF] = useState('')
  const [sel, setSel] = useState(null)
  const [err, setErr] = useState('')

  const load = useCallback(
    () =>
      api('/api/alerts' + (f ? `?severity=${f}` : ''))
        .then(setAl)
        .catch(e => setErr(e.message)),
    [f]
  )

  // Initial load + auto polling every 4 seconds
  useEffect(() => {
    load()
    const timer = setInterval(load, 4000)
    return () => clearInterval(timer)
  }, [load])

  return (
    <div>
      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        {['', 'HIGH', 'MEDIUM', 'LOW'].map(s => (
          <Btn key={s} on={f === s} onClick={() => setF(s)}>
            {s || 'ALL'}
          </Btn>
        ))}
        <Btn onClick={() => toCsv(al, 'alerts.csv')} disabled={!al.length}>
          <Download size={14} /> Export
        </Btn>
        <Btn onClick={load}>
          <RefreshCw size={14} /> Refresh
        </Btn>
        <span className="dim" style={{ marginLeft: 'auto', fontSize: 12 }}>
          Polling live every 4s · {al.length} alerts loaded
        </span>
      </div>

      <ErrorBox error={err} />

      <div className="two">
        <div className="log">
          {al.map(a => (
            <div
              key={a.id}
              style={{
                opacity: a.acknowledged ? 0.45 : 1,
                borderLeft: a.severity === 'HIGH' ? '3px solid var(--r)' : '3px solid transparent',
                paddingLeft: 10,
                paddingTop: 8,
                paddingBottom: 8,
                background: sel?.id === a.id ? 'var(--panel-hover)' : 'transparent',
                borderRadius: 6,
                marginBottom: 4,
                cursor: 'pointer'
              }}
              onClick={() => setSel(a)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span className="dim" style={{ fontSize: 11 }}>
                  {new Date(a.ts * 1000).toLocaleString()}
                </span>
                <span style={{ fontWeight: 600, fontSize: 12 }}>[{a.module}]</span>
                <Badge v={a.severity} />
                <Badge v={a.source} />
                {!a.acknowledged && (
                  <Btn
                    className="btn-sm"
                    style={{ marginLeft: 'auto', padding: '2px 8px', fontSize: 10 }}
                    onClick={e => {
                      e.stopPropagation()
                      api(`/api/alerts/${a.id}/ack`, 'POST').then(() => {
                        load()
                        bump?.()
                      })
                    }}
                  >
                    <CheckCircle2 size={12} /> Acknowledge
                  </Btn>
                )}
              </div>
              <div style={{ marginTop: 4, fontSize: 12, color: 'var(--fg)' }}>
                {a.message}
              </div>
            </div>
          ))}
          {!al.length && <p className="dim">No alerts.</p>}
        </div>

        <Card title="Alert Evidence & MITRE Reference">
          {sel ? (
            <div className="drawer">
              <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                <b>Rule: {sel.rule_id}</b> <Badge v={sel.severity} />
                <span style={{ marginLeft: 'auto', color: 'var(--r)', fontWeight: 'bold' }}>
                  +{sel.points} pts
                </span>
              </div>
              {sel.reference && (
                <div style={{ marginBottom: 12 }}>
                  <span className="dim">MITRE Reference: </span>
                  <a
                    href={getMitreUrl(sel.reference)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="drawer-link"
                    style={{ color: 'var(--c)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    <ExternalLink size={13} /> {sel.reference}
                  </a>
                </div>
              )}
              <div className="dim" style={{ marginBottom: 6 }}>Raw Collector Evidence:</div>
              <pre
                style={{
                  margin: 0,
                  padding: 10,
                  background: 'rgba(0,0,0,0.35)',
                  border: '1px solid var(--line)',
                  borderRadius: 6,
                  overflowX: 'auto',
                  fontSize: 11,
                  lineHeight: 1.5
                }}
              >
                {sel.evidence}
              </pre>
            </div>
          ) : (
            <span className="dim">Click an alert to view MITRE mapping and evidence.</span>
          )}
        </Card>
      </div>
    </div>
  )
}
