import { useMemo } from 'react'
import {
  Cpu,
  Folder,
  Globe,
  Terminal,
  Shield,
  Settings,
  Monitor,
  Code2,
  FileText,
  AlertTriangle,
  Network,
} from 'lucide-react'

// Pick app-specific colorful icon based on process name
function getAppVisual(name = '', flag = 'ok') {
  const n = String(name).toLowerCase()
  if (flag && flag !== 'ok') return { Icon: AlertTriangle, color: '#fb7185', bg: 'rgba(244, 63, 94, 0.18)' }
  if (/chrome|edge|firefox|brave|opera|browser/.test(n)) return { Icon: Globe, color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.18)' }
  if (/explorer|nautilus|finder/.test(n)) return { Icon: Folder, color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.18)' }
  if (/powershell|pwsh|cmd|bash|zsh|sh|terminal|conhost|wsl/.test(n)) return { Icon: Terminal, color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.16)' }
  if (/python|node|vite|uvicorn|code|java|ruby|go|rust/.test(n)) return { Icon: Code2, color: '#34d399', bg: 'rgba(52, 211, 153, 0.18)' }
  if (/lsass|defender|msmpeng|security|guardian|antivirus/.test(n)) return { Icon: Shield, color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.18)' }
  if (/csrss|dwm|winlogon|xorg|wayland/.test(n)) return { Icon: Monitor, color: '#93c5fd', bg: 'rgba(147, 197, 253, 0.16)' }
  if (/notepad|word|calc|editor/.test(n)) return { Icon: FileText, color: '#7dd3fc', bg: 'rgba(125, 211, 252, 0.16)' }
  if (/svchost|services|system|smss|wininit|systemd|init/.test(n)) return { Icon: Settings, color: '#e2e8f0', bg: 'rgba(226, 232, 240, 0.14)' }
  return { Icon: Cpu, color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.14)' }
}

function formatMem(kb) {
  if (kb == null) return '0 KB'
  const num = Number(kb)
  if (num >= 1024) return `${(num / 1024).toFixed(1)} MB`
  return `${Math.round(num)} KB`
}

function TreeNodeBranch({ node, byParent, openSet, onToggle, onSelect, selectedKey, depth = 0 }) {
  const key = node.source + node.pid
  const children = byParent[key] || []
  const hasKids = children.length > 0
  const isOpen = openSet.has(key)
  const isSelected = selectedKey === key
  const isSuspect = node.flag && node.flag !== 'ok'
  const { Icon, color, bg } = getAppVisual(node.name, node.flag)

  // Limit breadth per branch slightly only if huge, or show all cleanly
  const visibleChildren = isOpen ? children.slice(0, 14) : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
      {/* Glowing Process Card */}
      <div
        onClick={() => onSelect(node)}
        style={{
          position: 'relative',
          minWidth: 190,
          maxWidth: 230,
          padding: '10px 12px',
          borderRadius: 12,
          cursor: 'pointer',
          background: isSelected
            ? 'linear-gradient(135deg, rgba(14, 38, 72, 0.96), rgba(10, 25, 52, 0.96))'
            : 'linear-gradient(135deg, rgba(11, 24, 50, 0.88), rgba(8, 16, 36, 0.92))',
          border: `1.5px solid ${
            isSuspect
              ? '#fb7185'
              : isSelected
              ? '#38bdf8'
              : hasKids
              ? 'rgba(56, 189, 248, 0.65)'
              : 'rgba(56, 189, 248, 0.38)'
          }`,
          boxShadow: isSuspect
            ? '0 0 20px rgba(244, 63, 94, 0.35)'
            : isSelected || hasKids
            ? '0 0 22px rgba(56, 189, 248, 0.28), inset 0 1px 0 rgba(255,255,255,0.12)'
            : '0 6px 18px rgba(0, 0, 0, 0.45)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          transition: 'transform 0.18s ease, box-shadow 0.18s ease',
        }}
      >
        {/* App-Specific Glowing Icon */}
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            background: bg,
            border: `1px solid ${color}55`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: `0 0 12px ${color}33`,
          }}
        >
          <Icon size={18} color={color} />
        </div>

        {/* Name + PID / CPU / Mem */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: isSuspect ? '#fda4af' : '#f8fafc',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={node.name}
          >
            {node.name}
          </div>
          <div className="mono" style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
            PID: {node.pid} · CPU: {node.cpu ?? 0}%
          </div>
          <div className="mono" style={{ fontSize: 10, color: '#7dd3fc' }}>
            Mem: {formatMem(node.mem)}
          </div>
        </div>

        {/* Expand/Collapse Toggle (preserves '▾' for Vitest) */}
        {hasKids && (
          <button
            onClick={e => {
              e.stopPropagation()
              onToggle(key)
            }}
            title={isOpen ? 'Collapse children' : `Expand ${children.length} children`}
            style={{
              background: 'rgba(56, 189, 248, 0.16)',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              borderRadius: 6,
              color: '#38bdf8',
              fontSize: 11,
              fontWeight: 700,
              padding: '2px 6px',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            {isOpen ? '▾' : '▸'} {children.length}
          </button>
        )}
      </div>

      {/* Glowing Downward Connector + Children Row */}
      {hasKids && isOpen && depth < 5 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* Vertical stem from parent */}
          <div
            style={{
              width: 2,
              height: 18,
              background: 'linear-gradient(180deg, #38bdf8, #0ea5e9)',
              boxShadow: '0 0 8px rgba(56, 189, 248, 0.65)',
            }}
          />

          {/* Children Horizontal Row with Top Connecting Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'center',
              gap: 16,
              position: 'relative',
              paddingTop: 14,
            }}
          >
            {visibleChildren.length > 1 && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: '12%',
                  right: '12%',
                  height: 2,
                  background: 'rgba(56, 189, 248, 0.65)',
                  boxShadow: '0 0 8px rgba(56, 189, 248, 0.5)',
                }}
              />
            )}

            {visibleChildren.map(child => (
              <div key={child.source + child.pid} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                {/* Vertical drop + arrowhead into child */}
                <div
                  style={{
                    position: 'absolute',
                    top: -14,
                    width: 2,
                    height: 14,
                    background: '#38bdf8',
                    boxShadow: '0 0 6px rgba(56, 189, 248, 0.6)',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: -4,
                    width: 0,
                    height: 0,
                    borderLeft: '4px solid transparent',
                    borderRight: '4px solid transparent',
                    borderTop: '5px solid #38bdf8',
                  }}
                />
                <TreeNodeBranch
                  node={child}
                  byParent={byParent}
                  openSet={openSet}
                  onToggle={onToggle}
                  onSelect={onSelect}
                  selectedKey={selectedKey}
                  depth={depth + 1}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ProcessTreeGraph({ rows = [], openSet, onToggle, onSelect, selected, onExpandAll, onCollapseAll }) {
  const { roots, byParent } = useMemo(() => {
    const ids = new Set(rows.map(r => r.source + r.pid))
    const map = {}
    rows.forEach(r => {
      const pk = r.source + r.ppid
      map[pk] ||= []
      map[pk].push(r)
    })
    const rootNodes = rows
      .filter(r => !ids.has(r.source + r.ppid) || r.ppid === 0 || r.ppid === '0')
      .sort((a, b) => (map[b.source + b.pid]?.length || 0) - (map[a.source + a.pid]?.length || 0))
      .slice(0, 12)
    return { roots: rootNodes, byParent: map }
  }, [rows])

  const selectedKey = selected ? selected.source + selected.pid : ''

  return (
    <div
      style={{
        borderRadius: 14,
        background: 'radial-gradient(circle at 50% 0%, #0d1d3b 0%, #070e1f 65%, #050a16 100%)',
        border: '1px solid rgba(56, 189, 248, 0.3)',
        boxShadow: '0 16px 40px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(56, 189, 248, 0.15)',
        overflow: 'hidden',
      }}
    >
      {/* Header Bar */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid rgba(56, 189, 248, 0.18)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
          background: 'rgba(8, 16, 36, 0.65)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Network size={16} color="#38bdf8" />
          <span style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>Process Tree</span>
          <span className="mono" style={{ fontSize: 11, color: '#7dd3fc' }}>
            ({roots.length} root chains · {rows.length} processes)
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={onExpandAll}
            className="btn btn-sm"
            style={{ background: 'rgba(56, 189, 248, 0.14)', borderColor: 'rgba(56, 189, 248, 0.35)', color: '#7dd3fc' }}
          >
            Expand All
          </button>
          <button
            onClick={onCollapseAll}
            className="btn btn-sm"
            style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.12)', color: '#cbd5e1' }}
          >
            Collapse
          </button>
        </div>
      </div>

      {/* Scrollable Glowing Tree Canvas */}
      <div
        style={{
          padding: '24px 20px 28px',
          overflowX: 'auto',
          overflowY: 'auto',
          maxHeight: '62vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 28,
        }}
      >
        {roots.map(root => (
          <TreeNodeBranch
            key={root.source + root.pid}
            node={root}
            byParent={byParent}
            openSet={openSet}
            onToggle={onToggle}
            onSelect={onSelect}
            selectedKey={selectedKey}
          />
        ))}
      </div>
    </div>
  )
}
