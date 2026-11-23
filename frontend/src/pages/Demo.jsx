import { useState } from 'react'
import { api } from '../api'
import { Btn, ErrorBox } from '../components/ui'
const HINT = { port: 'Network: Save Baseline first, then Scan → NEW port', temp: 'Process: Scan → tmp_exec', deleted: 'Process: Scan → deleted_binary', file: 'File Vault: Add ~/guardian-lab/watched.txt, baseline, change, Verify', startup: 'Persistence: Save Baseline first, then Scan → NEW', reset: 'Removes every demo item' }
export default function Demo({ src }) {
  const s = src === 'windows' ? 'windows' : 'linux', [out, setOut] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState('')
  return <div><p>Source: <b>{s}</b> (use the switch). Test port {s === 'windows' ? 9998 : 9999}.</p><ErrorBox error={err} />
    {(s === 'windows' ? ['port', 'temp', 'startup', 'reset'] : ['port', 'temp', 'deleted', 'file', 'reset']).map(a => <div key={a}><Btn loading={busy === a} onClick={async () => { setBusy(a); try { const r = await api(`/api/demo/${a}?source=${s}`, 'POST'); setOut(`${a}: ${r.ok ? 'done' : 'failed'} ${r.output}`); setErr('') } catch (e) { setErr(e.message) } setBusy('') }}>{a}</Btn><span className="dim">{HINT[a]}</span></div>)}<pre>{out}</pre></div>
}
