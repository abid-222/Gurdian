import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { Btn } from '../components/ui'
const CMD = ['help', 'guardian status', 'guardian procs', 'guardian ports', 'guardian alerts', 'guardian score']
export default function Terminal() {
  const ref = useRef(), send = useRef(() => {})
  useEffect(() => {
    const t = new XTerm({ theme: { background: '#000', foreground: '#3fb950' }, cursorBlink: true, fontFamily: 'JetBrains Mono, monospace' }); t.open(ref.current)
    const ws = new WebSocket(`ws://${location.host}/api/terminal`), P = 'guardian@ubuntu:~$ ', H = []; let buf = '', hi = 0
    const set = v => { t.write('\b \b'.repeat(buf.length)); buf = v; t.write(v) }
    ws.onopen = () => t.write(P); ws.onclose = () => t.write('\r\n[disconnected]\r\n')
    ws.onmessage = e => t.write(e.data.replace(/\n/g, '\r\n') + (e.data ? '\r\n' : '') + P)
    send.current = c => { if (ws.readyState !== 1) return; set(c); t.write('\r\n'); H.push(c); hi = H.length; ws.send(c); buf = '' }
    t.onData(d => {
      if (d === '\r') { t.write('\r\n'); if (buf) H.push(buf); hi = H.length; ws.send(buf); buf = '' }
      else if (d === '\x7f') { if (buf) { buf = buf.slice(0, -1); t.write('\b \b') } }
      else if (d === '\x1b[A') { if (hi > 0) set(H[--hi]) } else if (d === '\x1b[B') { set(hi < H.length - 1 ? H[++hi] : ''); hi = Math.min(hi + 1, H.length) }
      else if (d === '\t') { const m = CMD.find(c => buf && c.startsWith(buf)); if (m) set(m) }
      else if (d.length === 1 && d >= ' ') { buf += d; t.write(d) }
    })
    return () => { ws.close(); t.dispose() }
  }, [])
  return <div>{CMD.map(c => <Btn key={c} onClick={() => send.current(c)}>{c}</Btn>)}<p className="dim">Read-only: only whitelisted commands. Tab completes, ↑/↓ history.</p><div ref={ref} /></div>
}
