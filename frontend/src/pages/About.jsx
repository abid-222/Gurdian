import {
  GraduationCap,
  Users,
  ClipboardCheck,
  ShieldCheck,
  Cpu,
  Layers,
  Award,
  Terminal,
  BookOpen
} from 'lucide-react'
import { Badge, Card } from '../components/ui'

const TEAM = [
  {
    name: 'Md. Abid Hossain',
    id: 'DIU-241-15-222',
    initials: 'AH',
    role: 'Team Lead & Backend Systems Architect',
    lead: true,
    modules: ['FastAPI Engine', 'Risk Engine (19 Rules)', 'SQLite WAL Database', 'Cross-Platform Bridges', 'Live WebSocket Telemetry'],
    contribution: 'Architected the core asynchronous daemon, live kernel psutil & procfs telemetry streaming, SQLite schema design, and the mathematical threat evaluation algorithm.'
  },
  {
    name: 'Tanvir Ahmed',
    id: 'DIU-241-15-223',
    initials: 'TA',
    role: 'Linux Collectors & Bash Core Specialist',
    lead: false,
    modules: ['Linux Collectors', 'Proc/SysFS Engine', 'Auth Log & SUID Audit', 'File Vault Integrity', 'Cron Daemon Watcher'],
    contribution: 'Authored POSIX-compliant bash collectors, cryptographic SHA-256 baselines, SUID privilege escalation trackers, and SSH/sudo brute-force detection heuristics.'
  },
  {
    name: 'Mahmudul Hasan',
    id: 'DIU-241-15-224',
    initials: 'MH',
    role: 'Windows Bridge & Systems Interop Engineer',
    lead: false,
    modules: ['Windows Bridge', 'PowerShell CIM/WMI', 'WinEvent Logs (4624/4625)', 'PnP USB Detection', 'Task Scheduler Audit'],
    contribution: 'Built native Windows bridge scripts using CIM/WMI instances, Windows Security Event Log parser, interactive session auditors, and registry persistence detectors.'
  },
  {
    name: 'Sadia Rahman',
    id: 'DIU-241-15-225',
    initials: 'SR',
    role: 'Frontend Architect & UI/UX Cyber Engineer',
    lead: false,
    modules: ['React 18 Dashboard', 'Theme Engine (Dark/Light)', 'Interactive Telemetry Charts', 'xterm.js Safe Terminal', 'Command Palette'],
    contribution: 'Engineered high-performance glassmorphic UI, 3D card physics, multi-palette theme engine, interactive forensic report previews, and keyboard-driven command navigation.'
  },
  {
    name: 'Nafis Fuad',
    id: 'DIU-241-15-226',
    initials: 'NF',
    role: 'Security Analyst & QA Automation Lead',
    lead: false,
    modules: ['MITRE ATT&CK Mapping', 'Vitest & Pytest Automation', 'Contract Verification', 'Red-Team Attack Lab', 'Compliance Engine'],
    contribution: 'Mapped 19 detection rules to official MITRE ATT&CK techniques, engineered end-to-end unit and contract test suites, and developed the red-team attack lab simulation harness.'
  }
]

const SPECS = [
  { label: 'Project Name', val: 'Smart OS Guardian (PRO v6.0 Enterprise HIDS)' },
  { label: 'Institution', val: 'Daffodil International University (DIU)' },
  { label: 'Department', val: 'Department of Computer Science & Engineering (CSE)' },
  { label: 'Course', val: 'Operating Systems & Security Capstone Defense (2026)' },
  { label: 'Core Architecture', val: 'FastAPI (Python 3.12) + React 18 (Vite) + SQLite 3 (WAL Mode)' },
  { label: 'Supported Platforms', val: 'Windows 11 / 10 & Linux (Ubuntu 22.04+ / WSL2 / Debian)' },
  { label: 'Data Mode', val: '100% Real-Time Kernel Telemetry (Zero Synthetic Mock Data)' },
  { label: 'Security Framework', val: 'MITRE ATT&CK Enterprise Matrix (19 Verified Rules)' },
]

export default function About() {
  return (
    <div>
      {/* ── Academic Defense Header Banner ── */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 6,
                  background: 'var(--panel-hover)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--fg)',
                  border: '1px solid var(--line)'
                }}
              >
                <GraduationCap size={20} strokeWidth={1.8} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h3 style={{ margin: 0, color: 'var(--fg)', fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>
                    University Project Defense & Engineering Portfolio
                  </h3>
                  <Badge v="CAPSTONE 2026" tone="p" />
                </div>
                <div className="dim" style={{ fontSize: 12, marginTop: 2 }}>
                  Daffodil International University · Department of Computer Science & Engineering
                </div>
              </div>
            </div>

            <p style={{ fontSize: 13, color: 'var(--fg)', margin: '8px 0 0', maxWidth: 760, lineHeight: 1.6, opacity: 0.9 }}>
              <b>Smart OS Guardian (PRO v6.0)</b> is an authoritative, multi-platform Host Intrusion Detection System (HIDS)
              and behavioral defense suite. Engineered to monitor kernel states, detect advanced persistent threats (APTs),
              and provide cryptographically verified incident response without external SaaS dependencies.
            </p>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              <Badge v="100% Real Data" tone="g" />
              <Badge v="Zero Mock Mode" tone="c" />
              <Badge v="19 MITRE Rules" tone="r" />
              <Badge v="Cross-Platform" tone="p" />
              <Badge v="Offline Air-Gapped" tone="a" />
              <Badge v="MIT Licensed" tone="g" />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <div
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--line)',
                padding: '8px 14px',
                borderRadius: 8,
                textAlign: 'right'
              }}
            >
              <div style={{ fontSize: 10, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Academic Session</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c)' }}>CSE Capstone 2026</div>
              <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 2 }}>Final Examination Defense</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4 Architectural Specification Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 18 }}>
        <Card className="" style={{ padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: 'var(--c)' }}>
            <Cpu size={18} />
            <span style={{ fontSize: 13, fontWeight: 700 }}>Telemetry Engine</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.5 }}>
            Direct Linux <code className="mono">/proc</code>, <code className="mono">/sys</code>, and Windows PowerShell CIM/WMI non-blocking native kernel polling.
          </div>
        </Card>

        <Card className="" style={{ padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: 'var(--g)' }}>
            <ShieldCheck size={18} />
            <span style={{ fontSize: 13, fontWeight: 700 }}>Risk Scoring</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.5 }}>
            19 MITRE ATT&CK heuristic rules with mathematical non-linear weighted penalty engine (0-100 threshold).
          </div>
        </Card>

        <Card className="" style={{ padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: 'var(--p)' }}>
            <Layers size={18} />
            <span style={{ fontSize: 13, fontWeight: 700 }}>Dual Platform</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.5 }}>
            Seamless cross-platform inspection for Windows 11/10 host machines and native Linux / WSL2 distributions.
          </div>
        </Card>

        <Card className="" style={{ padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: 'var(--r)' }}>
            <Terminal size={18} />
            <span style={{ fontSize: 13, fontWeight: 700 }}>Air-Gapped Ready</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.5 }}>
            Zero external CDN reliance; all fonts, vectors, charts, and SQLite database bundled for offline isolated enclaves.
          </div>
        </Card>
      </div>

      {/* ── Team Members & Module Ownership ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, color: 'var(--fg)', fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users size={18} color="var(--c)" />
          <span>Team Members & Module Ownership</span>
        </h3>
        <span className="dim" style={{ fontSize: 12 }}>
          5 Contributing Engineers · Multi-Disciplinary Roles
        </span>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', marginBottom: 20 }}>
        {TEAM.map((m) => (
          <Card key={m.id} className="" style={{ padding: 16 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              {/* Member Avatar with Initials */}
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 12,
                  background: m.lead
                    ? 'linear-gradient(135deg, rgba(99,102,241,0.3) 0%, rgba(56,189,248,0.3) 100%)'
                    : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${m.lead ? 'rgba(99,102,241,0.5)' : 'var(--line)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: m.lead ? 'var(--c)' : 'var(--fg)',
                  fontSize: 16,
                  fontWeight: 800,
                  flexShrink: 0,
                  boxShadow: m.lead ? '0 0 12px rgba(99,102,241,0.25)' : 'none'
                }}
              >
                {m.initials}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <h4 style={{ margin: 0, color: 'var(--fg)', fontSize: 15, fontWeight: 700 }}>
                    {m.name}
                  </h4>
                  <Badge v={m.id} tone={m.lead ? 'p' : 'c'} />
                </div>

                <div style={{ fontWeight: 600, color: m.lead ? 'var(--c)' : 'var(--g)', fontSize: 12, marginBottom: 8 }}>
                  {m.role}
                </div>

                <p className="dim" style={{ fontSize: 12, margin: '0 0 10px', lineHeight: 1.5 }}>
                  {m.contribution}
                </p>

                <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                  <span className="dim" style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                    Assigned Engineering Modules:
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {m.modules.map(mod => (
                      <Badge key={mod} v={mod} tone="c" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* ── Key Viva / Examiner Defense Highlights ── */}
      <Card
        className=""
        style={{ marginBottom: 20 }}
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ClipboardCheck size={18} color="var(--c)" />
            <span style={{ fontSize: 15, fontWeight: 700 }}>Key Viva / Examiner Defense Highlights</span>
          </span>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, fontSize: 12.5, lineHeight: 1.6 }}>
          <div style={{ background: 'var(--panel-2, rgba(255,255,255,0.02))', padding: 14, borderRadius: 8, border: '1px solid var(--line)' }}>
            <b style={{ color: 'var(--c)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Award size={15} color="var(--g)" /> 1. Strict Real-Data Guarantee:
            </b>
            <p className="dim" style={{ margin: 0 }}>
              Unlike dummy academic dashboards, every single process, socket, authentication event, and metric is queried in real time
              from kernel procfs, Windows CIM instances, or Windows Event Logs with zero mock data.
            </p>
          </div>

          <div style={{ background: 'var(--panel-2, rgba(255,255,255,0.02))', padding: 14, borderRadius: 8, border: '1px solid var(--line)' }}>
            <b style={{ color: 'var(--c)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Award size={15} color="var(--g)" /> 2. Zero-Exposure Security:
            </b>
            <p className="dim" style={{ margin: 0 }}>
              Authentication utilizes ephemeral internal bearer tokens injected exclusively via reverse proxy headers (<code style={{ color: 'var(--g)' }}>X-Guardian-Token</code>),
              preventing unauthorized API exploitation.
            </p>
          </div>

          <div style={{ background: 'var(--panel-2, rgba(255,255,255,0.02))', padding: 14, borderRadius: 8, border: '1px solid var(--line)' }}>
            <b style={{ color: 'var(--c)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Award size={15} color="var(--g)" /> 3. Behavioral Threat Engine:
            </b>
            <p className="dim" style={{ margin: 0 }}>
              Continuous evaluation across 19 mathematical heuristic rules detecting deleted binary execution, hidden temporary binaries,
              SSH/sudo brute force attempts, and SUID root escalations.
            </p>
          </div>

          <div style={{ background: 'var(--panel-2, rgba(255,255,255,0.02))', padding: 14, borderRadius: 8, border: '1px solid var(--line)' }}>
            <b style={{ color: 'var(--c)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Award size={15} color="var(--g)" /> 4. Offline-Ready Defense:
            </b>
            <p className="dim" style={{ margin: 0 }}>
              All dependencies, icons, and fonts (<code style={{ color: 'var(--g)' }}>@fontsource/jetbrains-mono</code>) are bundled locally on disk,
              making the system immediately deployable in secure, air-gapped forensic facilities.
            </p>
          </div>

          <div style={{ background: 'var(--panel-2, rgba(255,255,255,0.02))', padding: 14, borderRadius: 8, border: '1px solid var(--line)' }}>
            <b style={{ color: 'var(--c)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Award size={15} color="var(--g)" /> 5. Cross-Platform Interoperability:
            </b>
            <p className="dim" style={{ margin: 0 }}>
              Maintains full parity across Linux distributions and Windows operating systems through synchronized collector schemas
              and auto-detecting host platform routing.
            </p>
          </div>

          <div style={{ background: 'var(--panel-2, rgba(255,255,255,0.02))', padding: 14, borderRadius: 8, border: '1px solid var(--line)' }}>
            <b style={{ color: 'var(--c)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Award size={15} color="var(--g)" /> 6. Cryptographic Baseline Vault:
            </b>
            <p className="dim" style={{ margin: 0 }}>
              Watches vital configuration files with SHA-256 cryptographic hashes, identifying root privilege tampering,
              unauthorized modifications, and hidden registry persistence hooks.
            </p>
          </div>
        </div>
      </Card>

      {/* ── System Attestation & Specifications Table ── */}
      <Card
        className=""
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BookOpen size={16} color="var(--c)" />
            <span>Formal Project Defense Specifications</span>
          </span>
        }
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <tbody>
              {SPECS.map((s, idx) => (
                <tr
                  key={s.label}
                  style={{
                    borderBottom: idx === SPECS.length - 1 ? 'none' : '1px solid var(--line)',
                    background: idx % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent'
                  }}
                >
                  <td style={{ padding: '9px 12px', fontWeight: 600, color: 'var(--fg)', width: '28%' }}>
                    {s.label}
                  </td>
                  <td className="mono" style={{ padding: '9px 12px', color: 'var(--c)' }}>
                    {s.val}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
