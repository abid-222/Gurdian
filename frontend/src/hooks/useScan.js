import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'

export const LIMITED = /admin|sudo|permission|limited|cannot read/i

// Scans one or both sources in parallel; exposes loading / error / limited-mode state.
export function useScan(mod, src, auto = true) {
  const [s, setS] = useState({ data: null, loading: false, error: '', limited: false })

  const run = useCallback(async (fresh = false) => {
    setS(p => ({ ...p, loading: true, error: '' }))
    try {
      const sources = src === 'both' ? ['windows', 'linux'] : [src]
      const results = await Promise.allSettled(
        sources.map(x => api(`/api/scan/${mod}?source=${x}${fresh ? '&fresh=1' : ''}`, 'POST'))
      )

      const fulfilled = results
        .filter(r => r.status === 'fulfilled' && r.value)
        .map(r => r.value)

      if (fulfilled.length === 0) {
        const firstErr = results.find(r => r.status === 'rejected')?.reason?.message
        throw new Error(firstErr || 'Failed to fetch scan data')
      }

      const allRows = fulfilled.flatMap(r => r.rows || [])
      const allAlerts = fulfilled.flatMap(r => r.alerts || [])
      const allErrors = fulfilled.flatMap(r => r.errors || [])
      const riskScore = Math.min(100, fulfilled.reduce((a, r) => a + (r.risk_score || 0), 0))

      setS({
        data: {
          rows: allRows,
          alerts: allAlerts,
          errors: allErrors,
          risk_score: riskScore,
          started_at: fulfilled[0]?.started_at || new Date().toISOString()
        },
        loading: false,
        error: '',
        limited: allErrors.some(e => LIMITED.test(e))
      })
    } catch (e) {
      setS(p => ({ ...p, loading: false, error: e.message }))
    }
  }, [mod, src])

  useEffect(() => {
    if (auto) run()
  }, [run, auto])

  return { ...s, run }
}
