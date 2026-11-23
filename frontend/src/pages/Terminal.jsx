import { useEffect, useRef, useState } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { Copy, Check } from 'lucide-react'
import { Btn } from '../components/ui'

const CMD = [
  'help',
  'guardian status',
  'guardian procs',
  'guardian top',
  'guardian ports',
  'guardian alerts',
  'guardian score',
  'guardian timeline'
]

export default function Terminal() {
  const ref = useRef()
  const send = useRef(() => {})
  const [copied, setCopied] = useState(false)
  const fullLog = useRef([])

  useEffect(() => {
    const t = new XTerm({
      theme: { background: '#0b0f14', foreground: '#38b44a', cursor: '#38b44a' },
      cursorBlink: true,
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 13
    })
    t.open(ref.current)

    const ws = new WebSocket(`ws://${location.host}/api/terminal`)
    const P = 'guardian@ubuntu:~$ '
    const H = []
    let buf = ''
    let hi = 0

    const set = v => {
      t.write('\b \b'.repeat(buf.length))
      buf = v
      t.write(v)
    }

    ws.onopen = () => {
      t.write(P)
      fullLog.current.push(P)
    }
    ws.onclose = () => {
      t.write('\r\n[disconnected]\r\n')
      fullLog.current.push('\n[disconnected]\n')
    }
    ws.onmessage = e => {
      const formatted = e.data.replace(/\n/g, '\r\n') + (e.data ? '\r\n' : '') + P
      t.write(formatted)
      fullLog.current.push(e.data + '\n' + P)
    }

    send.current = c => {
      if (ws.readyState !== 1) return
      set(c)
      t.write('\r\n')
      H.push(c)
      hi = H.length
      ws.send(c)
      buf = ''
    }

    t.onData(d => {
      if (d === '\r') {
        t.write('\r\n')
        if (buf) H.push(buf)
        hi = H.length
        ws.send(buf)
        buf = ''
      } else if (d === '\x7f') {
        if (buf) {
          buf = buf.slice(0, -1)
          t.write('\b \b')
        }
      } else if (d === '\x1b[A') {
        if (hi > 0) set(H[--hi])
      } else if (d === '\x1b[B') {
        set(hi < H.length - 1 ? H[++hi] : '')
        hi = Math.min(hi + 1, H.length)
      } else if (d === '\t') {
        const m = CMD.find(c => buf && c.startsWith(buf))
        if (m) set(m)
      } else if (d.length === 1 && d >= ' ') {
        buf += d
        t.write(d)
      }
    })

    return () => {
      ws.close()
      t.dispose()
    }
  }, [])

  const copyOutput = () => {
    const text = fullLog.current.join('')
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        {CMD.map(c => (
          <Btn key={c} onClick={() => send.current(c)}>{c}</Btn>
        ))}
        <Btn onClick={copyOutput} style={{ marginLeft: 'auto' }}>
          {copied ? (
            <>
              <Check size={14} /> Copied
            </>
          ) : (
            <>
              <Copy size={14} /> Copy Output
            </>
          )}
        </Btn>
      </div>
      <p className="dim" style={{ margin: '0 0 10px' }}>
        Sandboxed read-only terminal with Tab auto-completion, ↑/↓ history, and command output clipboard export.
      </p>
      <div
        ref={ref}
        style={{
          border: '1px solid var(--line)',
          borderRadius: 6,
          overflow: 'hidden',
          boxShadow: '0 4px 14px rgba(0,0,0,0.5)'
        }}
      />
    </div>
  )
}
