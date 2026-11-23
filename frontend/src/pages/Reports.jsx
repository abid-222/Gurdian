import { FileText, FileCode2, FileSpreadsheet, Download, ShieldCheck, CheckCircle2, Clock, Database, Layers } from 'lucide-react'
import { Badge, Btn, Card } from '../components/ui'

export default function Reports() {
  const formats = [
    {
      fmt: 'html',
      name: 'HTML Executive Report',
      icon: FileSpreadsheet,
      badge: 'Visual Presentation',
      tone: 'g',
      desc: 'Interactive standalone HTML dashboard report with styled tables, risk score gauges, and evidence logs. Ideal for supervisors and examiners.',
      btn: 'Download HTML'
    },
    {
      fmt: 'json',
      name: 'JSON Machine Audit Report',
      icon: FileCode2,
      badge: 'SIEM / Automation',
      tone: 'c',
      desc: 'Raw machine-readable structured JSON export for SIEM ingestion, automated security pipelines, Splunk, or ELK stack.',
      btn: 'Download JSON'
    },
    {
      fmt: 'txt',
      name: 'Plain Text Terminal Summary',
      icon: FileText,
      badge: 'CLI / Archival',
      tone: 'p',
      desc: 'Clean ASCII terminal format designed for CLI piping, email dispatch, syslog integration, or offline forensic text archiving.',
      btn: 'Download TXT'
    }
  ]

  const now = new Date().toLocaleString()

  return (
    <div>
      {/* ── 3D Executive Audit Summary Banner ── */}
      <div className="status-banner-3d">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <ShieldCheck size={22} color="var(--c)" />
              <h3 style={{ margin: 0, color: 'var(--fg)', fontSize: 16 }}>
                Host Security Forensic & Compliance Reports
              </h3>
              <Badge v="VERIFIED AUDIT" tone="g" />
            </div>
            <p className="dim" style={{ fontSize: 13, margin: '4px 0 0', maxWidth: 720, lineHeight: 1.5 }}>
              Export authoritative, tamper-evident security audit reports containing complete scan histories, verified anomaly evidence,
              cryptographic baseline hashes, and MITRE ATT&CK technique classifications generated directly from SQLite.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <span className="dim" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={12} /> Audit Timestamp: {now}
            </span>
            <span className="dim" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Database size={12} /> Engine: SQLite Real-Data Daemon
            </span>
          </div>
        </div>

        {/* Audit Scope Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle2 size={14} color="var(--g)" />
            <span style={{ fontSize: 12 }}><b>Processes:</b> Hierarchy & Hashes</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle2 size={14} color="var(--g)" />
            <span style={{ fontSize: 12 }}><b>Network:</b> Sockets & Backdoors</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle2 size={14} color="var(--g)" />
            <span style={{ fontSize: 12 }}><b>File Vault:</b> SHA-256 Tampering</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle2 size={14} color="var(--g)" />
            <span style={{ fontSize: 12 }}><b>Persistence:</b> Cron & Registry</span>
          </div>
        </div>
      </div>

      {/* ── 3D Download Cards Grid ── */}
      <div className="grid">
        {formats.map(f => {
          const Icon = f.icon
          return (
            <Card key={f.fmt} className="card-3d" title={f.name}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--c)' }}>
                    <div style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: 'rgba(99, 102, 241, 0.12)',
                      border: '1px solid rgba(99, 102, 241, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--c)'
                    }}>
                      <Icon size={22} strokeWidth={2} />
                    </div>
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg)', display: 'block' }}>
                        .{f.fmt.toUpperCase()}
                      </span>
                      <span className="dim" style={{ fontSize: 11 }}>Structured File</span>
                    </div>
                  </div>
                  <Badge v={f.badge} tone={f.tone} />
                </div>

                <p className="dim" style={{ fontSize: 12, flex: 1, margin: 0, lineHeight: 1.6 }}>
                  {f.desc}
                </p>

                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--line)' }}>
                  <a href={`/api/report?fmt=${f.fmt}`} download style={{ textDecoration: 'none', display: 'block' }}>
                    <Btn style={{ width: '100%', justifyContent: 'center', padding: '9px 14px' }}>
                      <Download size={14} /> {f.btn}
                    </Btn>
                  </a>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Forensic Report Scope Info */}
      <Card title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Layers size={16} color="var(--c)" /> Forensic Report Scope & Compliance Guarantee</span>}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, fontSize: 12, lineHeight: 1.6 }}>
          <div>
            <b style={{ color: 'var(--c)' }}>Zero Mock Mode Guarantee:</b>
            <p className="dim" style={{ margin: '4px 0 0' }}>
              All metrics, processes, listening ports, and authentication logs exported in these reports represent verifiable operating system kernel states with zero simulated dummy records.
            </p>
          </div>
          <div>
            <b style={{ color: 'var(--c)' }}>Cryptographic Integrity Verification:</b>
            <p className="dim" style={{ margin: '4px 0 0' }}>
              The report embeds recalculated SHA-256 digests of all watched configuration files, providing indisputable evidence of any unauthorized modification.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
