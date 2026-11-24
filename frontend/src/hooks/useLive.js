import { useEffect, useState } from 'react'

// WebSocket with automatic reconnect (1 s, 2 s, 4 s ... max 10 s). Server-side errors arrive as {"error": "..."}.
export function useLive(src, active = true, keep = 300) {
  const isWin = typeof navigator !== 'undefined' && /win/i.test(navigator.userAgent || navigator.platform || '')
  const s = src === 'windows' ? 'windows' : (src === 'both' ? (isWin ? 'windows' : 'linux') : 'linux')
  const [pts, setPts] = useState([])
  const [conn, setConn] = useState('connecting')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!active) return
    let ws, t, n = 0, dead = false
    const open = () => {
      setConn('connecting')
      const proto = typeof location !== 'undefined' && location.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = typeof location !== 'undefined' ? location.host : 'localhost:8000'
      ws = new WebSocket(`${proto}//${host}/ws/live?source=${s}`)
      ws.onopen = () => { n = 0; setConn('live') }
      ws.onmessage = e => {
        try {
          const d = JSON.parse(e.data)
          if (d.error) setError(d.error)
          else {
            setError('')
            setPts(p => [...p, d].slice(-keep))
          }
        } catch {
          // Ignore malformed non-JSON frame safely
        }
      }
      ws.onclose = () => {
        if (dead) return
        setConn('reconnecting')
        t = setTimeout(open, Math.min(1000 * 2 ** n++, 10000))
      }
    }
    t = setTimeout(open, 0)
    return () => { dead = true; clearTimeout(t); ws?.close() }
  }, [s, active, keep])

  return { pts, last: pts.at(-1), status: !active ? 'paused' : conn, error }
}
