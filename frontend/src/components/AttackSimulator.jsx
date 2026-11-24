import { useState } from 'react'
import {
  Crosshair,
  RotateCcw,
  Play,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  Terminal,
  Activity,
  AlertTriangle,
  Sparkles,
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
      howDetected: 'Compares live listening sockets against baseline and flags unknown port 9998 as NEW.',
      expectedPoints: '+20 pts',
    },
    {
      id: 'temp',
      title: 'Suspicious Temp Binary Execution',
      mitre: 'T1059 · Command Execution',
      desc: 'Copies an executable to %TEMP%\\guardian_demo.exe and launches it in the background.',
      verifyMod: 'process',
      route: '#/process',
      howDetected: 'Inspects process executable paths and flags binaries running from Temp directories (tmp_exec).',
      expectedPoints: '+25 pts',
    },
    {
      id: 'startup',
      title: 'Registry Persistence Run Key',
      mitre: 'T1547.001 · Registry Run Keys',
      desc: 'Injects an auto-start entry in HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run.',
      verifyMod: 'persistence',
      route: '#/persistence',
      howDetected: 'Audits startup registry hives against baseline and flags unauthorized entries as NEW.',
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
      howDetected: 'Compares ss/netstat sockets against baseline and flags port 9999 as NEW.',
      expectedPoints: '+20 pts',
    },
    {
      id: 'temp',
      title: 'Suspicious /tmp Execution',
      mitre: 'T1059 · World-Writable Exec',
      desc: 'Copies binary to /tmp/guardian_demo and executes it in background.',
      verifyMod: 'process',
      route: '#/process',
      howDetected: 'Inspects /proc/[pid]/exe and flags execution from /tmp (tmp_exec).',
      expectedPoints: '+25 pts',
    },
    {
      id: 'deleted',
      title: 'Memory-Only Ghost Binary',
      mitre: 'T1070.004 · File Deletion',
      desc: 'Executes /tmp/gsleep and immediately unlinks the binary from disk while still running.',
      verifyMod: 'process',
      route: '#/process',
      howDetected: 'Detects "(deleted)" in /proc/[pid]/exe and raises CRITICAL deleted_binary alert.',
      expectedPoints: '+25 pts',
    },
    {
      id: 'file',
      title: 'File Vault Tampering',
      mitre: 'T1565.001 · Data Manipulation',
      desc: 'Modifies ~/guardian-lab/watched.txt to alter its cryptographic SHA-256 digest.',
      verifyMod: 'integrity',
      route: '#/integrity',
      howDetected: 'Recomputes SHA-256 hashes and flags mismatch against baseline as CHANGED.',
      expectedPoints: '+25 pts',
    },
  ],
}

function rowSignature(row) {
  return `${row.pid || ''}|${row.port || ''}|${row.name || ''}|${row.path || ''}|${row.entry || ''}|${row.sha256 || ''}`
}

function formatArtifact(r) {
  if (r.port) return { primary: `Port ${r.port} (${r.proto || 'TCP'})`, secondary: `${r.name || 'Socket'} · ${r.state || 'LISTENING'}` }
  if (r.pid) return { primary: `${r.name || 'Process'} (PID ${r.pid})`, secondary: r.path || r.cmd || 'Suspicious execution' }
  if (r.entry || r.path) return { primary: r.entry || r.path, secondary: r.sha256 ? `SHA256: ${String(r.sha256).slice(0, 16)}…` : 'Modified entry' }
  return { primary: 'Host Anomaly Artifact', secondary: JSON.stringify(r).slice(0, 60) }
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
      const [beforeScoreRes, beforeScanRes] = await Promise.all([
        api('/api/score').catch(() => ({ score: 0 })),
        api(`/api/scan/${scenario.verifyMod}?source=${s}`, 'POST').catch(() => ({ rows: [], alerts: [] })),
      ])
      const beforeScore = beforeScoreRes?.score ?? 0
      const beforeRows = beforeScanRes?.rows || []
      const beforeAlerts = beforeScanRes?.alerts || []
      const beforeSet = new Set(beforeRows.map(rowSignature))

      const actionRes = await api(`/api/demo/${scenario.id}?source=${s}`, 'POST')

      const [afterScanRes, afterScoreRes] = await Promise.all([
        api(`/api/scan/${scenario.verifyMod}?source=${s}`, 'POST').catch(() => ({ rows: [], alerts: [] })),
        api('/api/score').catch(() => ({ score: beforeScore })),
      ])
      const afterScore = afterScoreRes?.score ?? beforeScore
      const afterRows = afterScanRes?.rows || []
      const afterAlerts = afterScanRes?.alerts || []

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
        beforeAlertCount: beforeAlerts.length,
        afterAlertCount: afterAlerts.length,
        changedRows: changedRows.slice(0, 5),
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
      await Promise.allSettled([
        api(`/api/scan/network?source=${s}`, 'POST'),
        api(`/api/scan/process?source=${s}`, 'POST'),
        api(`/api/scan/persistence?source=${s}`, 'POST'),
      ])
      const afterScoreRes = await api('/api/score').catch(() => ({ score: 0 }))

      setProof({
        type: 'reset',
        output: actionRes?.output || 'All simulated threats terminated and removed.',
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

  const delta = proof ? proof.afterScore - proof.beforeScore : 0

  return (
    <div
      id="bas-simulator"
      className="card"
      style={{
        marginBottom: 0,
        padding: 20,
        background: 'linear-gradient(145deg, rgba(20, 22, 30, 0.88) 0%, rgba(16, 185, 129, 0.04) 55%, rgba(56, 189, 248, 0.05) 100%)',
        border: '1px solid rgba(56, 189, 248, 0.25)',
        borderRadius: 14,
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
          paddingBottom: 14,
          marginBottom: 16,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'rgba(244, 63, 94, 0.14)',
              border: '1px solid rgba(244, 63, 94, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fb7185',
            }}
          >
            <Crosshair size={18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg)' }}>
                Breach &amp; Attack Simulation (Before / After Detection Proof)
              </span>
              <Badge v={`TARGET: ${s.toUpperCase()}`} tone="c" />
            </div>
            <div className="dim" style={{ fontSize: 12, marginTop: 2 }}>
              Simulate real host threats and compare the exact Before vs After OS state, risk score delta, and fired rules.
            </div>
          </div>
        </div>

        <Btn
          onClick={restoreBaseline}
          loading={busyId === 'reset'}
          style={{
            background: 'rgba(16, 185, 129, 0.14)',
            color: '#34d399',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            fontWeight: 600,
          }}
        >
          <RotateCcw size={13} /> Restore Baseline
        </Btn>
      </div>

      <ErrorBox error={err} />

      {/* Scenario Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 12,
          marginBottom: 18,
        }}
      >
        {scenarios.map(sc => {
          const isActive = proof?.type === 'attack' && proof?.scenario?.id === sc.id
          return (
            <div
              key={sc.id}
              style={{
                padding: 14,
                borderRadius: 11,
                background: 'rgba(12, 14, 20, 0.72)',
                border: isActive ? '1px solid rgba(244, 63, 94, 0.55)' : '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg)' }}>{sc.title}</span>
                  <Badge v={sc.expectedPoints} tone="a" />
                </div>
                <div style={{ marginBottom: 8 }}>
                  <Badge v={sc.mitre} tone="p" />
                </div>
                <p className="dim" style={{ margin: '0 0 8px', fontSize: 11, lineHeight: 1.45 }}>
                  {sc.desc}
                </p>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', padding: '7px 9px', borderRadius: 7, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <b style={{ color: '#38bdf8' }}>Detection Rule:</b> {sc.howDetected}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Btn
                  loading={busyId === sc.id}
                  onClick={() => runSimulation(sc)}
                  style={{
                    flex: 1,
                    justifyContent: 'center',
                    background: 'rgba(244, 63, 94, 0.16)',
                    color: '#fb7185',
                    border: '1px solid rgba(244, 63, 94, 0.4)',
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
                    justifyContent: 'center',
                    padding: '7px 10px',
                    borderRadius: 7,
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: 'var(--text-secondary)',
                    textDecoration: 'none',
                  }}
                >
                  <ExternalLink size={13} />
                </a>
              </div>
            </div>
          )
        })}
      </div>

      {/* Crystal-Clear Side-by-Side BEFORE vs AFTER Comparison */}
      {!proof ? (
        <div
          style={{
            padding: '14px 16px',
            borderRadius: 10,
            background: 'rgba(56, 189, 248, 0.06)',
            border: '1px dashed rgba(56, 189, 248, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 12,
            color: 'var(--text-secondary)',
          }}
        >
          <Sparkles size={16} color="#38bdf8" />
          <span>
            Click <b style={{ color: '#fb7185' }}>Run Attack &amp; Detect</b> on any scenario above to view the live <b style={{ color: 'var(--fg)' }}>Before vs After</b> system diff, newly detected OS artifacts, and triggered rules.
          </span>
        </div>
      ) : (
        <div
          style={{
            padding: 18,
            borderRadius: 12,
            background: 'rgba(10, 12, 18, 0.78)',
            border: `1px solid ${proof.type === 'reset' ? 'rgba(16, 185, 129, 0.42)' : 'rgba(244, 63, 94, 0.42)'}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {/* Proof Banner */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {proof.type === 'reset' ? <CheckCircle2 size={18} color="#34d399" /> : <ShieldAlert size={18} color="#fb7185" />}
              <span style={{ fontWeight: 700, fontSize: 14, color: proof.type === 'reset' ? '#34d399' : '#fb7185' }}>
                {proof.type === 'reset'
                  ? 'Baseline Restored — All Simulated Threats Cleared'
                  : `Attack Detected: ${proof.scenario.title}`}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="mono dim" style={{ fontSize: 11 }}>Verified at {proof.timestamp}</span>
              {proof.type === 'attack' && (
                <a
                  href={proof.scenario.route}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '5px 10px',
                    borderRadius: 6,
                    background: 'rgba(56, 189, 248, 0.14)',
                    border: '1px solid rgba(56, 189, 248, 0.35)',
                    color: '#38bdf8',
                    fontSize: 11,
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  <Activity size={12} /> Inspect in {proof.scenario.verifyMod} <ExternalLink size={11} />
                </a>
              )}
            </div>
          </div>

          {/* 3-Column Visual Before / Delta / After Comparison */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'stretch' }}>
            {/* BEFORE */}
            <div
              style={{
                padding: 14,
                borderRadius: 10,
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="mono" style={{ fontSize: 10, fontWeight: 700, color: '#34d399' }}>1. BEFORE (BASELINE)</span>
                <ShieldCheck size={14} color="#34d399" />
              </div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: '#34d399' }}>
                Risk: {proof.beforeScore}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                {proof.beforeCount !== undefined
                  ? `${proof.beforeCount} host items · ${proof.beforeAlertCount} alerts`
                  : 'Pre-cleanup system posture'}
              </div>
            </div>

            {/* DELTA ARROW */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 8px',
                gap: 6,
              }}
            >
              <Badge
                v={delta > 0 ? `+${delta} RISK` : delta < 0 ? `${delta} RISK` : 'VERIFIED'}
                tone={delta > 0 ? 'r' : 'g'}
              />
              <ArrowRight size={20} color={delta > 0 ? '#fb7185' : '#34d399'} />
            </div>

            {/* AFTER */}
            <div
              style={{
                padding: 14,
                borderRadius: 10,
                background: proof.type === 'reset' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(244, 63, 94, 0.10)',
                border: `1px solid ${proof.type === 'reset' ? 'rgba(16, 185, 129, 0.35)' : 'rgba(244, 63, 94, 0.42)'}`,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="mono" style={{ fontSize: 10, fontWeight: 700, color: proof.type === 'reset' ? '#34d399' : '#fb7185' }}>
                  2. AFTER ({proof.type === 'reset' ? 'RESTORED' : 'DETECTED'})
                </span>
                {proof.type === 'reset' ? <CheckCircle2 size={14} color="#34d399" /> : <AlertTriangle size={14} color="#fb7185" />}
              </div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: proof.type === 'reset' ? '#34d399' : '#fb7185' }}>
                Risk: {proof.afterScore}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                {proof.afterCount !== undefined
                  ? `${proof.afterCount} host items · ${proof.afterAlertCount} alerts`
                  : 'All demo artifacts removed'}
              </div>
            </div>
          </div>

          {/* Raw OS Execution Log */}
          {proof.output && (
            <div className="mono" style={{ fontSize: 11, padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Terminal size={13} color="var(--accent)" />
              <span>{proof.output}</span>
            </div>
          )}

          {/* Detailed Artifact & Rule Breakdown */}
          {proof.type === 'attack' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
              <div style={{ padding: 12, borderRadius: 9, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(56, 189, 248, 0.22)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', marginBottom: 8 }}>
                  NEW / CHANGED OS ARTIFACTS ({proof.changedRows.length})
                </div>
                {proof.changedRows.length === 0 ? (
                  <span className="dim" style={{ fontSize: 11 }}>No new artifacts detected in scan diff.</span>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {proof.changedRows.map((r, i) => {
                      const info = formatArtifact(r)
                      return (
                        <div key={i} style={{ padding: '6px 8px', borderRadius: 6, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                          <div style={{ minWidth: 0 }}>
                            <div className="mono" style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg)' }}>{info.primary}</div>
                            <div className="mono dim" style={{ fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{info.secondary}</div>
                          </div>
                          <Badge v={r.status || (r.flags && r.flags[0]) || 'FLAGGED'} tone="r" />
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div style={{ padding: 12, borderRadius: 9, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(244, 63, 94, 0.22)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#fb7185', marginBottom: 8 }}>
                  DETECTION RULES FIRED ({proof.alerts.length})
                </div>
                {proof.alerts.length === 0 ? (
                  <span className="dim" style={{ fontSize: 11 }}>No rule alerts fired for this scan.</span>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {proof.alerts.slice(0, 4).map((a, i) => (
                      <div key={i} style={{ padding: '6px 8px', borderRadius: 6, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Badge v={a.severity} />
                        <div style={{ flex: 1, minWidth: 0, fontSize: 11, color: 'var(--fg)' }}>
                          <b>{a.rule}:</b> {a.message}
                        </div>
                        <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24' }}>+{a.points}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
