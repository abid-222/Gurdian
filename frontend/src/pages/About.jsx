import { GraduationCap, Users, ClipboardCheck, ShieldCheck } from 'lucide-react'
import { Badge, Card } from '../components/ui'

const TEAM = [
  {
    name: 'Md. Abid Hossain',
    id: 'DIU-241-15-222',
    role: 'Team Lead & Backend Architect',
    modules: ['FastAPI Engine', 'Risk Engine (19 Rules)', 'SQLite Database', 'Cross-Platform Bridges'],
    contribution: 'Designed core daemon, WebSocket telemetry streams, SQLite schema, and behavioral threat scoring algorithms.'
  },
  {
    name: 'Tanvir Ahmed',
    id: 'DIU-241-15-223',
    role: 'Linux Collectors & Bash Specialist',
    modules: ['Linux Collectors', 'Proc/SysFS Engine', 'Auth Log & SUID Audit', 'File Vault'],
    contribution: 'Authored POSIX-compliant bash collectors, cryptographic SHA-256 baselines, and SSH/sudo brute-force detection.'
  },
  {
    name: 'Mahmudul Hasan',
    id: 'DIU-241-15-224',
    role: 'Windows Bridge & Systems Engineer',
    modules: ['Windows Bridge', 'PowerShell Interop', 'WinEvent Logs', 'PnP USB Detection'],
    contribution: 'Built Windows bridge scripts using CIM/WMI instances, Security Event Log (4624/4625) parser, and quser session auditor.'
  },
  {
    name: 'Sadia Rahman',
    id: 'DIU-241-15-225',
    role: 'Frontend & UI/UX Cyberpunk Engineer',
    modules: ['React 18 Dashboard', 'Theme Engine', 'Radar Visualization', 'xterm.js Terminal'],
    contribution: 'Created responsive tmux/i3 terminal interface, multi-theme engine (Ubuntu/Tokyo Night/Nord/Dracula), and charts.'
  },
  {
    name: 'Nafis Fuad',
    id: 'DIU-241-15-226',
    role: 'Security Analyst & QA Automation Lead',
    modules: ['MITRE ATT&CK Mapping', 'Vitest & Pytest Suites', 'Contract Verification', 'Red-Team Lab'],
    contribution: 'Mapped 19 detection rules to MITRE ATT&CK techniques, wrote automated unit/contract test suites, and demo red-team scripts.'
  }
]

export default function About() {
  return (
    <div>
      {/* Project Overview Card */}
      <Card title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><GraduationCap size={16} color="var(--c)" /> University Project Defense & Team Portfolio</span>}>
        <h3 style={{ margin: '0 0 6px', color: 'var(--c)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShieldCheck size={20} color="var(--c)" /> Smart OS Guardian (v6.0 Enterprise)
        </h3>
        <p className="dim" style={{ fontSize: 13, lineHeight: 1.6 }}>
          A Next-Generation Real-Time Host Intrusion Detection System (HIDS) and Multi-Platform Security Dashboard designed for
          high-performance host auditing across native Linux (WSL2) and Windows operating systems.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          <Badge v="100% Real Data" tone="g" />
          <Badge v="Zero Mock Mode" tone="c" />
          <Badge v="19 MITRE Rules" tone="r" />
          <Badge v="Cross-Platform" tone="p" />
          <Badge v="MIT Licensed" tone="a" />
        </div>
      </Card>

      {/* Team Members Grid */}
      <h3 style={{ margin: '18px 0 10px', color: 'var(--fg)', fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Users size={18} color="var(--c)" /> Team Members & Module Ownership
      </h3>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        {TEAM.map((m, idx) => (
          <Card key={idx}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <h4 style={{ margin: 0, color: 'var(--c)', fontSize: 14 }}>{m.name}</h4>
              <Badge v={m.id} tone="p" />
            </div>
            <div style={{ fontWeight: 600, color: 'var(--g)', fontSize: 12, marginBottom: 8 }}>
              {m.role}
            </div>
            <div className="dim" style={{ marginBottom: 10 }}>
              {m.contribution}
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8 }}>
              <span className="dim" style={{ display: 'block', marginBottom: 4 }}>Owned Modules:</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {m.modules.map(mod => (
                  <Badge key={mod} v={mod} tone="c" />
                ))}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Defense Checklist for Examiners */}
      <Card title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><ClipboardCheck size={16} color="var(--c)" /> Key Viva / Examiner Defense Highlights</span>}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, fontSize: 12 }}>
          <div>
            <b style={{ color: 'var(--c)' }}>1. Strict Real-Data Guarantee:</b>
            <p className="dim" style={{ margin: '4px 0 0' }}>
              Unlike dummy dashboards, every row, socket, process, and metric is read in real time from kernel procfs, Windows CIM, or Event Logs.
            </p>
          </div>
          <div>
            <b style={{ color: 'var(--c)' }}>2. Zero-Exposure Security:</b>
            <p className="dim" style={{ margin: '4px 0 0' }}>
              Authentication utilizes ephemeral tokens injected exclusively via Vite proxy headers (<code style={{ color: 'var(--g)' }}>X-Guardian-Token</code>).
            </p>
          </div>
          <div>
            <b style={{ color: 'var(--c)' }}>3. Behavioral Threat Engine:</b>
            <p className="dim" style={{ margin: '4px 0 0' }}>
              Continuous evaluation across 19 rules (deleted binary executions, tmp executables, brute force logins, SUID privilege escalation).
            </p>
          </div>
          <div>
            <b style={{ color: 'var(--c)' }}>4. Offline-Ready Defense:</b>
            <p className="dim" style={{ margin: '4px 0 0' }}>
              All dependencies and fonts (<code style={{ color: 'var(--g)' }}>@fontsource/jetbrains-mono</code>) are bundled locally.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
