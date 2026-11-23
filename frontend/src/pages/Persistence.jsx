import { useState } from 'react'
import { api } from '../api'
import { useScan } from '../hooks/useScan'
import { Badge, Btn, Card, ErrorBox } from '../components/ui'
export default function Persistence({ src }) {
  const { data, loading, error, run } = useScan('persistence', src), [onlyNew, setOnlyNew] = useState(false), [err, setErr] = useState('')
  const rows = (data?.rows || []).filter(r => !onlyNew || r.status === 'NEW'), groups = rows.reduce((m, r) => ((m[r.type] ||= []).push(r), m), {})
  const save = async () => { try { await Promise.all((src === 'both' ? ['linux', 'windows'] : [src]).map(s => api(`/api/baseline/persistence?source=${s}`, 'POST'))); run() } catch (e) { setErr(e.message) } }
  return <div><Btn onClick={run} loading={loading}>Hunt Persistence</Btn><Btn onClick={save}>Save Baseline</Btn><Btn on={onlyNew} onClick={() => setOnlyNew(!onlyNew)}>Show Only NEW</Btn>
    <ErrorBox error={error || err} errors={data?.errors} />{data?.alerts.map((a, i) => <div key={i}><Badge v={a.severity} /> {a.message}</div>)}
    <div className="grid">{Object.entries(groups).map(([t, l]) => <Card key={t} title={`${t} (${l.length})`}>{l.map((r, i) => <div key={i} style={{ marginBottom: 6 }}><Badge v={r.source} /> {r.status === 'NEW' && <Badge v="NEW" />} {r.location}<div className="dim">first seen {r.first_seen || '-'}</div></div>)}</Card>)}</div>{!rows.length && !loading && <p className="dim">Nothing to show.</p>}</div>
}
