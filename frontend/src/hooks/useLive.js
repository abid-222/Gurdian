import { useEffect, useState } from 'react'
// WebSocket with automatic reconnect (1 s, 2 s, 4 s ... max 10 s). Server-side errors arrive as {"error": "..."}.
export function useLive(src, active = true, keep = 300) {
  const s = src === 'windows' ? 'windows' : 'linux', [pts, setPts] = useState([]), [conn, setConn] = useState('connecting'), [error, setError] = useState('')
  useEffect(() => {
    if (!active) return
    let ws, t, n = 0, dead = false
    const open = () => {
      setConn('connecting'); ws = new WebSocket(`ws://${location.host}/ws/live?source=${s}`)
      ws.onopen = () => { n = 0; setConn('live') }
      ws.onmessage = e => { const d = JSON.parse(e.data); if (d.error) setError(d.error); else { setError(''); setPts(p => [...p, d].slice(-keep)) } }
      ws.onclose = () => { if (dead) return; setConn('reconnecting'); t = setTimeout(open, Math.min(1000 * 2 ** n++, 10000)) }
    }
    t = setTimeout(open, 0); return () => { dead = true; clearTimeout(t); ws?.close() }
  }, [s, active, keep])
  return { pts, last: pts.at(-1), status: !active ? 'paused' : conn, error }
}
