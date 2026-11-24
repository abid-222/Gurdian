import { useEffect, useRef, useState } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { Copy, Check, Terminal as TerminalIcon } from 'lucide-react'
import { Btn } from '../components/ui'

const CMD = [
  'help',
  'guardian status',
  'guardian procs',
  'guardian top',
  'guardian ports',
  'guardian alerts',
  'guardian score',
  'guardian timeline',
  'whoami',
  'pwd',
  'ls',
  'uptime',
  'date',
  'ps',
  'top',
  'netstat',
  'df',
  'free',
  'ipconfig',
  'clear'
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

    const proto = typeof location !== 'undefined' && location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = typeof location !== 'undefined' ? location.host : 'localhost:8000'
    const ws = new WebSocket(`${proto}//${host}/api/terminal`)
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
      if (e.data && e.data.includes('\x1b[2J')) {
        t.clear()
        t.write(P)
        fullLog.current = [P]
        return
      }
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
      {/* ── 3D Terminal Window Container ── */}
      <div
        style={{
          background: '#0d1117',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
          marginBottom: 16
        }}
      >
        {/* Window Titlebar */}
        <div
          style={{
            background: 'linear-gradient(180deg, #1f242c 0%, #161b22 100%)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12
          }}
        >
          {/* Traffic light dots */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#ff5f56', display: 'inline-block', boxShadow: '0 0 6px rgba(255,95,86,0.4)' }} />
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#ffbd2e', display: 'inline-block', boxShadow: '0 0 6px rgba(255,189,46,0.4)' }} />
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#27c93f', display: 'inline-block', boxShadow: '0 0 6px rgba(39,201,63,0.4)' }} />
          </div>

          {/* Window Title */}
          <div style={{ color: '#c9d1d9', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <TerminalIcon size={13} color="var(--g)" />
            <span>guardian@ubuntu:~ (bash) — 80x24</span>
          </div>

          {/* Header Action */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="badge g" style={{ fontSize: 10, padding: '2px 8px' }}>CONNECTED</span>
            <Btn onClick={copyOutput} style={{ padding: '3px 10px', fontSize: 11, margin: 0 }}>
              {copied ? (
                <>
                  <Check size={13} /> Copied
                </>
              ) : (
                <>
                  <Copy size={13} /> Copy Output
                </>
              )}
            </Btn>
          </div>
        </div>

        {/* XTerm mount target */}
        <div
          ref={ref}
          style={{
            padding: '12px 14px',
            background: '#090d14',
            minHeight: 340
          }}
        />
      </div>

      {/* Quick Launch Commands */}
      <div className="card" style={{ marginTop: 12 }}>
        <h4 style={{ margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <TerminalIcon size={14} color="var(--c)" /> Quick Shell Commands (Click to Execute)
        </h4>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
          {CMD.map(c => (
            <Btn key={c} onClick={() => send.current(c)} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
              {c}
            </Btn>
          ))}
        </div>
        <p className="dim" style={{ margin: 0, fontSize: 11 }}>
          💡 <b>Keyboard Shortcuts:</b> Press <code>Tab</code> for command auto-completion, <code>↑</code> / <code>↓</code> arrows for bash command history.
        </p>
      </div>
    </div>
  )
}
