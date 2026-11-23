import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
export const LIMITED = /admin|sudo|permission|limited|cannot read/i
// Scans one or both sources in parallel; exposes loading / error / limited-mode state.
export function useScan(mod, src, auto = true) {
  const [s, setS] = useState({ data: null, loading: false, error: '', limited: false })
  const run = useCallback(async () => {
    setS(p => ({ ...p, loading: true, error: '' }))
    try {
      const rs = await Promise.all((src === 'both' ? ['linux', 'windows'] : [src]).map(x => api(`/api/scan/${mod}?source=${x}`, 'POST')))
      const errors = rs.flatMap(r => r.errors || [])
      setS({ data: { rows: rs.flatMap(r => r.rows), alerts: rs.flatMap(r => r.alerts), errors, risk_score: Math.min(100, rs.reduce((a, r) => a + r.risk_score, 0)), started_at: rs[0].started_at }, loading: false, error: '', limited: errors.some(e => LIMITED.test(e)) })
    } catch (e) { setS(p => ({ ...p, loading: false, error: e.message })) }
  }, [mod, src])
  useEffect(() => { if (auto) run() }, [run, auto])
  return { ...s, run }
}
