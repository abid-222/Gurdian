import { useCallback, useEffect, useState } from 'react'
import { Clock, RefreshCw, Download } from 'lucide-react'
import { api, toCsv } from '../api'
import { Badge, Btn, ErrorBox } from '../components/ui'

const TONE = {
  alert: 'r',
  login_failed: 'a',
  login_ok: 'g',
  sudo: 'c',
  su: 'c',
  baseline_saved: 'p',
  snapshot: 'c'
}
const MODULES = ['', 'auth', 'process', 'network', 'integrity', 'persistence', 'usb', 'system']

export default function Timeline() {
  const [hours, setHours] = useState(24)
  const [mod, setMod] = useState('')
  const [ev, setEv] = useState([])
  const [err, setErr] = useState('')

  const load = useCallback(
    () =>
      api(`/api/timeline?hours=${hours}${mod ? `&module=${mod}` : ''}`)
        .then(d => {
          setEv(d)
          setErr('')
        })
        .catch(e => setErr(e.message)),
    [hours, mod]
  )

  useEffect(() => {
    load()
  }, [load])

  return (
    <div>
      {/* ── Filter Toolbar ── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'inline-flex', gap: 4, background: 'rgba(0,0,0,0.25)', padding: '2px 4px', borderRadius: 8, border: '1px solid var(--line)' }}>
          <span className="dim" style={{ padding: '0 6px', fontSize: 11, alignSelf: 'center', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={12} /> Range:
          </span>
          {[
            [1, '1h'],
            [24, '24h'],
            [168, '7d']
          ].map(([h, l]) => (
            <Btn key={h} on={hours === h} onClick={() => setHours(h)} style={{ margin: 0, padding: '2px 8px', fontSize: 11 }}>
              {l}
            </Btn>
          ))}
        </div>

        <Btn onClick={load}>
          <RefreshCw size={14} /> Refresh
        </Btn>
        <Btn onClick={() => toCsv(ev, 'timeline.csv')} disabled={!ev.length}>
          <Download size={14} /> Export CSV
        </Btn>

        <span className="dim" style={{ marginLeft: 'auto', fontSize: 12 }}>
          {ev.length} historical events loaded
        </span>
      </div>

      {/* ── Module Filter Pills ── */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {MODULES.map(m => (
          <Btn key={m} on={mod === m} onClick={() => setMod(m)} className="btn-sm">
            {m || 'ALL'}
          </Btn>
        ))}
      </div>

      <ErrorBox error={err} />

      {/* ── Timeline Events Feed ── */}
      <div className="log" style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 12, padding: 14 }}>
        {ev.map((e, i) => (
          <div
            key={i}
            style={{
              padding: '10px 12px',
              borderBottom: i < ev.length - 1 ? '1px solid var(--line-light)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap'
            }}
          >
            <span className="dim" style={{ fontSize: 11, minWidth: 150 }}>
              {new Date(e.ts * 1000).toLocaleString()}
            </span>
            <Badge v={e.source} />
            <span style={{ fontWeight: 600, fontSize: 12 }}>[{e.module}]</span>
            <Badge v={e.kind} tone={TONE[e.kind] || 'c'} />
            <span style={{ color: 'var(--fg)', fontSize: 12, flex: 1, minWidth: 200 }}>
              {e.summary}
            </span>
          </div>
        ))}
        {!ev.length && (
          <p className="dim" style={{ textAlign: 'center', padding: '24px 0', margin: 0 }}>
            No events in this range. Run scans, save baselines, or check the Auth page.
          </p>
        )}
      </div>
    </div>
  )
}
