import { useEffect, useRef, useState } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { Copy, Check, Terminal as TerminalIcon, Trash2, Shield, Cpu, GitBranch, TerminalSquare } from 'lucide-react'
import { Badge, Btn } from '../components/ui'

const CMD_GROUPS = [
  {
    title: 'Security Audit',
    icon: Shield,
    color: 'var(--g)',
    cmds: ['guardian status', 'guardian score', 'guardian alerts', 'guardian timeline', 'guardian persistence', 'guardian integrity', 'guardian usb'],
  },
  {
    title: 'Live Forensics',
    icon: Cpu,
    color: 'var(--c)',
    cmds: ['guardian top', 'guardian procs', 'guardian ports', 'ss -tulnp', 'lsof -i'],
  },
  {
    title: 'Deadlock & Attack Sim',
    icon: GitBranch,
    color: 'var(--p)',
    cmds: ['guardian deadlock status', 'guardian simulate port', 'guardian simulate reset'],
  },
  {
    title: 'Linux / Bash Shell',
    icon: TerminalSquare,
    color: 'var(--a)',
    cmds: ['uname -a', 'free -m', 'df -h', 'ls -la', 'ps aux | head -n 8', 'whoami', 'uptime', 'help'],
  },
]

const ALL_CMDS = CMD_GROUPS.flatMap(g => g.cmds)

export default function Terminal() {
  const ref = useRef()
  const send = useRef(() => {})
  const [copied, setCopied] = useState(false)
  const [connected, setConnected] = useState(false)
  const fullLog = useRef([])

  useEffect(() => {
    const t = new XTerm({
      theme: { background: '#090d14', foreground: '#d1fae5', cursor: '#10b981' },
      cursorBlink: true,
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 13,
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
      setConnected(true)
      t.write(P)
      fullLog.current.push(P)
    }
    ws.onclose = () => {
      setConnected(false)
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
        const m = ALL_CMDS.find(c => buf && c.startsWith(buf))
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Unslop Unified Terminal Window */}
      <div
        style={{
          background: '#090d14',
          border: '1px solid var(--line)',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <div
          style={{
            background: 'var(--panel)',
            borderBottom: '1px solid var(--line)',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f56' }} />
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ffbd2e' }} />
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#27c93f' }} />
            </div>
            <div className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <TerminalIcon size={13} color="var(--g)" />
              <span>Guardian Unified Shell (Bash + Linux Sandbox)</span>
            </div>
            <Badge v={connected ? 'CONNECTED' : 'STANDBY'} tone={connected ? 'g' : 'a'} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Btn onClick={() => send.current('clear')} className="btn-sm">
              <Trash2 size={12} /> Clear
            </Btn>
            <Btn onClick={copyOutput} className="btn-sm">
              {copied ? <Check size={12} color="var(--g)" /> : <Copy size={12} />}
              {copied ? 'Copied' : 'Copy Output'}
            </Btn>
          </div>
        </div>

        <div ref={ref} style={{ padding: '12px 14px', background: '#090d14', minHeight: 340 }} />
      </div>

      {/* Categorized Quick Command Dock */}
      <div className="card" style={{ marginBottom: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          {CMD_GROUPS.map(g => {
            const Icon = g.icon
            return (
              <div key={g.title} style={{ padding: 10, borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: g.color, marginBottom: 8 }}>
                  <Icon size={13} /> {g.title}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {g.cmds.map(c => (
                    <Btn key={c} onClick={() => send.current(c)} className="btn-sm" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
                      {c}
                    </Btn>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
        <div className="dim" style={{ marginTop: 10, fontSize: 11 }}>
          Supports Bash pipes (<code>| grep</code>, <code>| head</code>, <code>| tail</code>, <code>| wc -l</code>), <code>Tab</code> autocomplete, and <code>↑/↓</code> history.
        </div>
      </div>
    </div>
  )
}
