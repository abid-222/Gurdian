import { FileText, FileCode2, FileSpreadsheet, Download } from 'lucide-react'
import { Btn, Card } from '../components/ui'

export default function Reports() {
  const formats = [
    {
      fmt: 'html',
      name: 'HTML Executive Report',
      icon: FileSpreadsheet,
      desc: 'Interactive standalone HTML dashboard report with styled tables, risk score gauges, and evidence logs.',
      btn: 'Download HTML'
    },
    {
      fmt: 'json',
      name: 'JSON Machine Audit Report',
      icon: FileCode2,
      desc: 'Raw machine-readable structured JSON export for SIEM ingestion, automated pipelines, or Splunk / ELK.',
      btn: 'Download JSON'
    },
    {
      fmt: 'txt',
      name: 'Plain Text Terminal Summary',
      icon: FileText,
      desc: 'Clean ASCII terminal format designed for CLI piping, email summaries, or offline text archiving.',
      btn: 'Download TXT'
    }
  ]

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <p className="dim" style={{ fontSize: 13, margin: 0 }}>
          Export comprehensive system security reports including all module scans, calculated risk scores, verified alerts with MITRE ATT&CK evidence, timeline events, and historical metrics directly from the local SQLite database.
        </p>
      </div>

      <div className="grid">
        {formats.map(f => {
          const Icon = f.icon
          return (
            <Card key={f.fmt} title={f.name}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--c)' }}>
                  <Icon size={28} strokeWidth={1.8} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg)' }}>
                    .{f.fmt.toUpperCase()} Format
                  </span>
                </div>
                <p className="dim" style={{ fontSize: 12, flex: 1, margin: 0, lineHeight: 1.6 }}>
                  {f.desc}
                </p>
                <div style={{ marginTop: 8 }}>
                  <a href={`/api/report?fmt=${f.fmt}`} download style={{ textDecoration: 'none' }}>
                    <Btn style={{ width: '100%', justifyContent: 'center' }}>
                      <Download size={14} /> {f.btn}
                    </Btn>
                  </a>
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
