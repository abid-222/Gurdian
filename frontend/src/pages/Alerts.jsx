import { useCallback, useEffect, useState } from 'react'
import { api, toCsv } from '../api'
import { Badge, Btn, Card, ErrorBox } from '../components/ui'

const getMitreUrl = (ref) => {
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

  const load = useCallback(() => (
    api('/api/alerts' + (f ? `?severity=${f}` : ''))
      .then(setAl)
      .catch(e => setErr(e.message))
  ), [f])

  // Initial load + auto polling every 4 seconds
  useEffect(() => {
    load()
    const timer = setInterval(load, 4000)
    return () => clearInterval(timer)
  }, [load])

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        {['', 'HIGH', 'MEDIUM', 'LOW'].map(s => (
          <Btn key={s} on={f === s} onClick={() => setF(s)}>{s || 'ALL'}</Btn>
        ))}
        <Btn onClick={() => toCsv(al, 'alerts.csv')} disabled={!al.length}>Export</Btn>
        <Btn onClick={load}>Refresh</Btn>
        <span className="dim">Polling live every 4s · {al.length} alerts loaded</span>
      </div>

      <ErrorBox error={err} />

      <div className="two">
        <div className="log">
          {al.map(a => (
            <div
              key={a.id}
              style={{
                opacity: a.acknowledged ? 0.45 : 1,
                borderLeft: a.severity === 'HIGH' ? '3px solid var(--r)' : undefined,
                paddingLeft: a.severity === 'HIGH' ? 8 : undefined
              }}
              onClick={() => setSel(a)}
            >
              <span className="dim">
                {new Date(a.ts * 1000).toLocaleString()}
              </span>{' '}
              [{a.module}] <Badge v={a.severity} /> {a.message} <Badge v={a.source} />
              {!a.acknowledged && (
                <Btn
                  className="btn-sm"
                  style={{ marginLeft: 8 }}
                  onClick={e => {
                    e.stopPropagation()
                    api(`/api/alerts/${a.id}/ack`, 'POST').then(() => {
                      load()
                      bump?.()
                    })
                  }}
                >
                  Acknowledge
                </Btn>
              )}
            </div>
          ))}
          {!al.length && <p className="dim">No alerts.</p>}
        </div>

        <Card title="Alert Evidence & MITRE Reference">
          {sel ? (
            <div className="drawer">
              <div style={{ marginBottom: 8 }}>
                <b>Rule: {sel.rule_id}</b> <Badge v={sel.severity} />
                <span style={{ marginLeft: 8, color: 'var(--r)', fontWeight: 'bold' }}>+{sel.points} pts</span>
              </div>
              {sel.reference && (
                <div style={{ marginBottom: 10 }}>
                  <span className="dim">MITRE Reference: </span>
                  <a
                    href={getMitreUrl(sel.reference)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="drawer-link"
                    style={{ color: 'var(--c)', fontWeight: 600 }}
                  >
                    🔗 {sel.reference}
                  </a>
                </div>
              )}
              <div className="dim" style={{ marginBottom: 4 }}>Raw Collector Evidence:</div>
              <pre style={{ margin: 0, padding: 8, background: 'rgba(0,0,0,0.3)', borderRadius: 4, overflowX: 'auto', fontSize: 11 }}>
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
