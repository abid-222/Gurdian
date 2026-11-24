import { useState } from 'react'
import {
  Crosshair,
  RotateCcw,
  Play,
  ShieldAlert,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  Terminal,
  Activity,
} from 'lucide-react'
import { api } from '../api'
import { Badge, Btn, ErrorBox } from './ui'

const SCENARIOS = {
  windows: [
    {
      id: 'port',
      title: 'Backdoor Listening Port (9998)',
      mitre: 'T1571 · Non-Standard Port',
      desc: 'Opens an unauthorized background TCP listener on port 9998 using .NET Sockets.',
      verifyMod: 'network',
      route: '#/network',
      howDetected: 'Network Perimeter compares live listening sockets against the saved baseline and flags unknown ports as NEW.',
      expectedPoints: '+20 pts',
    },
    {
      id: 'temp',
      title: 'Suspicious Temp Binary Execution',
      mitre: 'T1059 · Command Execution',
      desc: 'Copies an executable to %TEMP%\\guardian_demo.exe and launches it in the background.',
      verifyMod: 'process',
      route: '#/process',
      howDetected: 'Process Forensics inspects executable paths and flags binaries running from user-writable Temp directories (tmp_exec).',
      expectedPoints: '+25 pts',
    },
    {
      id: 'startup',
      title: 'Registry Persistence Run Key',
      mitre: 'T1547.001 · Registry Run Keys',
      desc: 'Injects an auto-start entry in HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run.',
      verifyMod: 'persistence',
      route: '#/persistence',
      howDetected: 'Persistence Watch audits startup registry hives against baseline and flags unauthorized entries as NEW.',
      expectedPoints: '+20 pts',
    },
  ],
  linux: [
    {
      id: 'port',
      title: 'Backdoor Listening Port (9999)',
      mitre: 'T1571 · Non-Standard Port',
      desc: 'Opens an unauthorized TCP socket on port 9999 via netcat.',
      verifyMod: 'network',
      route: '#/network',
      howDetected: 'Network Perimeter compares ss/netstat sockets against baseline and flags port 9999 as NEW.',
      expectedPoints: '+20 pts',
    },
    {
      id: 'temp',
      title: 'Suspicious /tmp Execution',
      mitre: 'T1059 · World-Writable Exec',
      desc: 'Copies binary to /tmp/guardian_demo and executes it in background.',
      verifyMod: 'process',
      route: '#/process',
      howDetected: 'Process Forensics inspects /proc/[pid]/exe and flags execution from /tmp (tmp_exec).',
      expectedPoints: '+25 pts',
    },
    {
      id: 'deleted',
      title: 'Memory-Only Ghost Binary',
      mitre: 'T1070.004 · File Deletion',
      desc: 'Executes /tmp/gsleep and immediately unlinks the binary from disk while still running.',
      verifyMod: 'process',
      route: '#/process',
      howDetected: 'Process Forensics detects "(deleted)" in /proc/[pid]/exe and raises CRITICAL deleted_binary alert.',
      expectedPoints: '+25 pts',
    },
    {
      id: 'file',
      title: 'File Vault Tampering',
      mitre: 'T1565.001 · Data Manipulation',
      desc: 'Modifies ~/guardian-lab/watched.txt to alter its cryptographic SHA-256 digest.',
      verifyMod: 'integrity',
      route: '#/integrity',
      howDetected: 'File Vault recomputes SHA-256 hashes and flags mismatch against baseline as CHANGED.',
      expectedPoints: '+25 pts',
    },
  ],
}

function rowSignature(row) {
  return `${row.pid || ''}|${row.port || ''}|${row.name || ''}|${row.path || ''}|${row.entry || ''}|${row.sha256 || ''}`
}

export default function AttackSimulator({ src = 'both', onUpdate }) {
  const s = src === 'linux' ? 'linux' : 'windows'
  const scenarios = SCENARIOS[s] || SCENARIOS.windows

  const [busyId, setBusyId] = useState('')
  const [err, setErr] = useState('')
  const [proof, setProof] = useState(null)

  const runSimulation = async scenario => {
    setBusyId(scenario.id)
    setErr('')
    try {
      // 1. Capture BEFORE baseline snapshot
      const [beforeScoreRes, beforeScanRes] = await Promise.all([
        api('/api/score').catch(() => ({ score: 0 })),
        api(`/api/scan/${scenario.verifyMod}?source=${s}`, 'POST').catch(() => ({ rows: [], alerts: [] })),
      ])
      const beforeScore = beforeScoreRes?.score ?? 0
      const beforeRows = beforeScanRes?.rows || []
      const beforeSet = new Set(beforeRows.map(rowSignature))

      // 2. Execute real OS simulation script
      const actionRes = await api(`/api/demo/${scenario.id}?source=${s}`, 'POST')

      // 3. Capture AFTER snapshot & detection alerts
      const [afterScanRes, afterScoreRes] = await Promise.all([
        api(`/api/scan/${scenario.verifyMod}?source=${s}`, 'POST').catch(() => ({ rows: [], alerts: [] })),
        api('/api/score').catch(() => ({ score: beforeScore })),
      ])
      const afterScore = afterScoreRes?.score ?? beforeScore
      const afterRows = afterScanRes?.rows || []
      const afterAlerts = afterScanRes?.alerts || []

      // Compute newly introduced / flagged rows
      const changedRows = afterRows.filter(
        r => !beforeSet.has(rowSignature(r)) || r.status === 'NEW' || r.status === 'CHANGED' || (Array.isArray(r.flags) && r.flags.length > 0)
      )

      setProof({
        type: 'attack',
        scenario,
        output: actionRes?.output || (actionRes?.ok ? 'Executed on host' : 'Completed'),
        beforeScore,
        afterScore,
        beforeCount: beforeRows.length,
        afterCount: afterRows.length,
        changedRows: changedRows.slice(0, 4),
        alerts: afterAlerts,
        timestamp: new Date().toLocaleTimeString(),
      })

      onUpdate?.()
    } catch (e) {
      setErr(e?.message || 'Simulation failed')
    } finally {
      setBusyId('')
    }
  }

  const restoreBaseline = async () => {
    setBusyId('reset')
    setErr('')
    try {
      const beforeScoreRes = await api('/api/score').catch(() => ({ score: 0 }))
      const actionRes = await api(`/api/demo/reset?source=${s}`, 'POST')
      // Re-scan modules to clear transient alerts & update score
      await Promise.allSettled([
        api(`/api/scan/network?source=${s}`, 'POST'),
        api(`/api/scan/process?source=${s}`, 'POST'),
        api(`/api/scan/persistence?source=${s}`, 'POST'),
      ])
      const afterScoreRes = await api('/api/score').catch(() => ({ score: 0 }))

      setProof({
        type: 'reset',
        output: actionRes?.output || 'All simulated artifacts terminated and removed.',
        beforeScore: beforeScoreRes?.score ?? 0,
        afterScore: afterScoreRes?.score ?? 0,
        timestamp: new Date().toLocaleTimeString(),
      })
      onUpdate?.()
    } catch (e) {
      setErr(e?.message || 'Cleanup failed')
    } finally {
      setBusyId('')
    }
  }

  return (
    <div
      id="bas-simulator"
      className="card"
      style={{
        marginBottom: 0,
        background: 'linear-gradient(135deg, rgba(22, 24, 32, 0.85) 0%, rgba(56, 189, 248, 0.04) 100%)',
        border: '1px solid rgba(56, 189, 248, 0.22)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          paddingBottom: 12,
          marginBottom: 14,
          borderBottom: '1px solid var(--line)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'rgba(244, 63, 94, 0.14)',
              border: '1px solid rgba(244, 63, 94, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fb7185',
            }}
          >
            <Crosshair size={16} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg)' }}>
                Breach &amp; Attack Simulation (Live Detection Proof)
              </span>
              <Badge v={`TARGET: ${s.toUpperCase()}`} tone="c" />
            </div>
            <div className="dim" style={{ fontSize: 11 }}>
              Trigger harmless host anomalies to verify real-time Before/After OS changes, rule matching, and risk scoring.
            </div>
          </div>
        </div>

        <Btn
          onClick={restoreBaseline}
          loading={busyId === 'reset'}
          style={{
            background: 'rgba(16, 185, 129, 0.12)',
            color: '#34d399',
            border: '1px solid rgba(16, 185, 129, 0.35)',
          }}
        >
          <RotateCcw size={13} /> Restore Baseline
        </Btn>
      </div>

      <ErrorBox error={err} />

      {/* Scenario Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 12,
          marginBottom: proof ? 16 : 0,
        }}
      >
        {scenarios.map(sc => {
          const isActive = proof?.type === 'attack' && proof?.scenario?.id === sc.id
          return (
            <div
              key={sc.id}
              style={{
                padding: 14,
                borderRadius: 10,
                background: 'var(--bg)',
                border: isActive ? '1px solid rgba(244, 63, 94, 0.5)' : '1px solid var(--line)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg)' }}>{sc.title}</span>
                  <Badge v={sc.expectedPoints} tone="a" />
                </div>
                <div style={{ marginBottom: 6 }}>
                  <Badge v={sc.mitre} tone="p" />
                </div>
                <p className="dim" style={{ margin: '0 0 8px', fontSize: 11, lineHeight: 1.45 }}>
                  {sc.desc}
                </p>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', padding: '6px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--line-light)' }}>
                  <b style={{ color: '#38bdf8' }}>Detection:</b> {sc.howDetected}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <Btn
                  loading={busyId === sc.id}
                  onClick={() => runSimulation(sc)}
                  style={{
                    flex: 1,
                    justifyContent: 'center',
                    background: 'rgba(244, 63, 94, 0.14)',
                    color: '#fb7185',
                    border: '1px solid rgba(244, 63, 94, 0.35)',
                    fontWeight: 600,
                  }}
                >
                  <Play size={12} /> Run Attack &amp; Detect
                </Btn>
                <a
                  href={sc.route}
                  title={`Open ${sc.verifyMod} page`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '6px 9px',
                    borderRadius: 6,
                    border: '1px solid var(--line)',
                    color: 'var(--text-secondary)',
                    fontSize: 11,
                    textDecoration: 'none',
                  }}
                >
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>
          )
        })}
      </div>

      {/* Live Before vs After Detection Proof Panel */}
      {proof && (
        <div
          style={{
            padding: 16,
            borderRadius: 10,
            background: proof.type === 'reset' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(244, 63, 94, 0.08)',
            border: `1px solid ${proof.type === 'reset' ? 'rgba(16, 185, 129, 0.35)' : 'rgba(244, 63, 94, 0.35)'}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {proof.type === 'reset' ? (
                <CheckCircle2 size={16} color="#34d399" />
              ) : (
                <ShieldAlert size={16} color="#fb7185" />
              )}
              <span style={{ fontWeight: 700, fontSize: 13, color: proof.type === 'reset' ? '#34d399' : '#fb7185' }}>
                {proof.type === 'reset'
                  ? 'Baseline Restored — Simulated Threats Removed'
                  : `Detection Proof: ${proof.scenario.title}`}
              </span>
            </div>
            <span className="mono dim" style={{ fontSize: 11 }}>
              Verified at {proof.timestamp}
            </span>
          </div>

          {/* Before -> After Metric Comparison */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.28)', border: '1px solid var(--line)' }}>
              <div className="dim" style={{ fontSize: 10 }}>BEFORE</div>
              <div className="mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)' }}>
                Risk Score: {proof.beforeScore}
                {proof.beforeCount !== undefined ? ` · ${proof.beforeCount} items` : ''}
              </div>
            </div>

            <ArrowRight size={16} color="var(--dim)" />

            <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.28)', border: `1px solid ${proof.type === 'reset' ? 'rgba(16,185,129,0.4)' : 'rgba(244,63,94,0.4)'}` }}>
              <div className="dim" style={{ fontSize: 10 }}>AFTER</div>
              <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: proof.type === 'reset' ? '#34d399' : '#fb7185' }}>
                Risk Score: {proof.afterScore}
                {proof.afterCount !== undefined ? ` · ${proof.afterCount} items` : ''}
              </div>
            </div>

            {proof.type === 'attack' && (
              <a
                href={proof.scenario.route}
                style={{
                  marginLeft: 'auto',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 12px',
                  borderRadius: 7,
                  background: 'rgba(56, 189, 248, 0.14)',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  color: '#38bdf8',
                  fontSize: 11,
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                <Activity size={13} /> Inspect Live in {proof.scenario.verifyMod} <ExternalLink size={12} />
              </a>
            )}
          </div>

          {/* Raw OS Output */}
          {proof.output && (
            <div className="mono" style={{ fontSize: 11, padding: '6px 10px', borderRadius: 6, background: 'rgba(0,0,0,0.35)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Terminal size={12} color="var(--accent)" />
              <span>{proof.output}</span>
            </div>
          )}

          {/* Changed OS Artifacts & Triggered Alerts */}
          {proof.type === 'attack' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
              <div style={{ padding: 10, borderRadius: 8, background: 'rgba(0,0,0,0.25)', border: '1px solid var(--line)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#38bdf8', marginBottom: 6 }}>
                  OS Changes Detected ({proof.changedRows.length})
                </div>
                {proof.changedRows.length === 0 ? (
                  <span className="dim" style={{ fontSize: 11 }}>No new artifacts found in scan diff.</span>
                ) : (
                  proof.changedRows.map((r, i) => (
                    <div key={i} className="mono" style={{ fontSize: 11, padding: '3px 0', color: 'var(--fg)', display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.port ? `Port ${r.port} (${r.name || 'socket'})` : r.name || r.path || r.entry || 'Artifact'}
                      </span>
                      <Badge v={r.status || (r.flags && r.flags[0]) || 'FLAGGED'} tone="r" />
                    </div>
                  ))
                )}
              </div>

              <div style={{ padding: 10, borderRadius: 8, background: 'rgba(0,0,0,0.25)', border: '1px solid var(--line)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#fb7185', marginBottom: 6 }}>
                  Rule Engine Alerts Fired ({proof.alerts.length})
                </div>
                {proof.alerts.length === 0 ? (
                  <span className="dim" style={{ fontSize: 11 }}>No rule alerts fired for this scan.</span>
                ) : (
                  proof.alerts.slice(0, 4).map((a, i) => (
                    <div key={i} style={{ fontSize: 11, padding: '3px 0', color: 'var(--fg)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Badge v={a.severity} />
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <b>{a.rule}:</b> {a.message}
                      </span>
                      <span className="mono" style={{ color: '#fbbf24' }}>+{a.points}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
