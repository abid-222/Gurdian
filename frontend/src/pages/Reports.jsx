import { Btn } from '../components/ui'
export default function Reports() {
  return <div><p>Scans, risk score, alerts with evidence, timeline and score history from SQLite.</p>{['html', 'txt', 'json'].map(f => <a key={f} href={`/api/report?fmt=${f}`} download><Btn>Download {f.toUpperCase()}</Btn></a>)}</div>
}
