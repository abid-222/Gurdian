import { useState } from 'react'
import { api } from '../api'
import { Badge, Btn, Card, ErrorBox } from '../components/ui'

const DEMO_SCENARIOS = {
  windows: [
    {
      id: 'port',
      title: '1. Backdoor Listening Port Simulation',
      mitre: 'T1571: Non-Standard Port',
      desc: 'Opens a hidden background TCP socket on port 9998 using .NET Sockets.',
      verifyMod: 'network',
      impact: '+20 Risk Score · Radar shows RED dot · Flagged as NEW port'
    },
    {
      id: 'temp',
      title: '2. Suspicious Temp Binary Execution',
      mitre: 'T1059: Command & Scripting Execution',
      desc: 'Copies executable to %TEMP%\\guardian_demo.exe and runs it hidden.',
      verifyMod: 'process',
      impact: '+25 Risk Score · Process tree flags "tmp_exec" anomaly'
    },
    {
      id: 'startup',
      title: '3. Registry Persistence Run Key Injection',
      mitre: 'T1547.001: Registry Run Keys',
      desc: 'Adds a persistent auto-start entry in HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run.',
      verifyMod: 'persistence',
      impact: '+20 Risk Score · Persistence auditor flags new startup entry'
    },
    {
      id: 'reset',
      title: '4. Clean Up & Reset Defense Lab',
      mitre: 'Lab Teardown',
      desc: 'Terminates demo processes, closes port 9998, deletes registry key, and resets score.',
      verifyMod: null,
      impact: 'Restores score to 0 (SAFE) · All demo artifacts removed'
    }
  ],
  linux: [
    {
      id: 'port',
      title: '1. Backdoor Listening Port Simulation',
      mitre: 'T1571: Non-Standard Port',
      desc: 'Opens an unauthorized listening socket on port 9999 with nc.',
      verifyMod: 'network',
      impact: '+20 Risk Score · Network baseline detects unexpected port'
    },
    {
      id: 'temp',
      title: '2. Suspicious Execution from /tmp',
      mitre: 'T1059: Execution from World-Writable Dir',
      desc: 'Copies sleep to /tmp/guardian_demo and executes it in background.',
      verifyMod: 'process',
      impact: '+25 Risk Score · Flagged with "tmp_exec" badge'
    },
    {
      id: 'deleted',
      title: '3. Memory-Only Ghost Binary Execution',
      mitre: 'T1070.004: File Deletion in Memory',
      desc: 'Runs /tmp/gsleep and immediately unlinks binary from disk.',
      verifyMod: 'process',
      impact: '+25 Risk Score · Flagged with "deleted_binary" CRITICAL badge'
    },
    {
      id: 'file',
      title: '4. File Vault Tampering',
      mitre: 'T1565.001: Stored Data Manipulation',
      desc: 'Appends data to ~/guardian-lab/watched.txt to alter cryptographic hash.',
      verifyMod: 'integrity',
      impact: '+25 Risk Score · File Vault flags CHANGED hash'
    },
    {
      id: 'reset',
      title: '5. Clean Up & Reset Defense Lab',
      mitre: 'Lab Teardown',
      desc: 'Terminates all demo processes and removes temporary files.',
      verifyMod: null,
      impact: 'Restores score to 0 (SAFE) · All demo artifacts removed'
    }
  ]
}

export default function Demo({ src }) {
  const s = src === 'windows' ? 'windows' : 'linux'
  const [out, setOut] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState('')
  const [activeStep, setActiveStep] = useState(null)
  const [scanResult, setScanResult] = useState(null)
  const [scanning, setScanning] = useState(false)

  const scenarios = DEMO_SCENARIOS[s] || DEMO_SCENARIOS.linux

  const runAction = async (actionId) => {
    setBusy(actionId)
    setActiveStep(actionId)
    setErr('')
    setScanResult(null)
    try {
      const r = await api(`/api/demo/${actionId}?source=${s}`, 'POST')
      setOut(`${actionId}: ${r.ok ? '✓ executed successfully' : '✖ failed'} ${r.output || ''}`)
    } catch (e) {
      setErr(e.message)
    }
    setBusy('')
  }

  const verifyNow = async (mod) => {
    if (!mod) return
    setScanning(true)
    try {
      const res = await api(`/api/scan/${mod}?source=${s}`, 'POST')
      setScanResult({ mod, alerts: res.alerts || [], count: res.rows?.length || 0 })
    } catch (e) {
      setErr(e.message)
    }
    setScanning(false)
  }

  return (
    <div>
      {/* Supervisor Presentation Banner */}
      <Card title="🎓 Supervisor Demonstration & Defense Lab Mode">
        <h3 style={{ margin: '0 0 6px', color: 'var(--c)' }}>
          Live Host Threat Simulation & Proof of Real-Time Detection
        </h3>
        <p className="dim" style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>
          Supervisors often ask: <b>&quot;How do I know this is real data and how does it catch actual attacks?&quot;</b>
          <br />
          Use this interactive simulation lab to trigger real, harmless behavioral anomalies on your system and watch
          Guardian immediately calculate risk points, trigger detection rules, and flag evidence live.
        </p>
      </Card>

      <ErrorBox error={err} />
      {out && (
        <div style={{ background: 'rgba(56,180,74,0.1)', border: '1px solid var(--g)', padding: '8px 12px', borderRadius: 4, marginBottom: 12, fontSize: 12 }}>
          <b>Lab Action Output:</b> {out}
        </div>
      )}

      {/* Simulation Scenario Cards */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        {scenarios.map((item) => (
          <Card key={item.id} className={activeStep === item.id ? 'sel' : ''}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <h4 style={{ margin: 0, color: 'var(--c)', fontSize: 13 }}>{item.title}</h4>
              <Badge v={item.mitre} tone="p" />
            </div>
            <p className="dim" style={{ fontSize: 12, margin: '4px 0 10px' }}>
              {item.desc}
            </p>
            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '6px 8px', borderRadius: 4, fontSize: 11, marginBottom: 10 }}>
              <b style={{ color: 'var(--a)' }}>Expected Detection: </b>
              <span className="dim">{item.impact}</span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Btn
                loading={busy === item.id}
                onClick={() => runAction(item.id)}
                className={item.id === 'reset' ? 'btn-danger' : ''}
              >
                {item.id === 'reset' ? '🧹 Reset Lab' : `▶ Trigger ${item.id}`}
              </Btn>
              {item.verifyMod && (
                <Btn
                  onClick={() => verifyNow(item.verifyMod)}
                  loading={scanning}
                  style={{ borderColor: 'var(--c)', color: 'var(--c)' }}
                >
                  🔍 Verify {item.verifyMod}
                </Btn>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Verification Live Feedback */}
      {scanResult && (
        <Card title={`Live Detection Verification Result: ${scanResult.mod}`}>
          <div style={{ fontSize: 12, marginBottom: 8 }}>
            Scanned <b>{scanResult.count}</b> host items. Detected <b>{scanResult.alerts.length}</b> threat alert(s):
          </div>
          {scanResult.alerts.map((a, i) => (
            <div key={i} style={{ padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <Badge v={a.severity} /> <b>{a.rule}</b>: {a.message} (+{a.points} pts)
            </div>
          ))}
          {!scanResult.alerts.length && (
            <span className="dim">No alerts triggered yet. Click Trigger on the scenario first, then Verify.</span>
          )}
        </Card>
      )}

      {/* Supervisor Presentation Talk Track (Cheatsheet) */}
      <Card title="🗣️ Step-by-Step Viva Presentation Script (Supervisor-কে যেভাবে বোঝাবেন)">
        <div style={{ fontSize: 12, lineHeight: 1.7 }}>
          <div style={{ marginBottom: 10 }}>
            <b style={{ color: 'var(--g)' }}>ধাপ ১: ড্যাশবোর্ডের বেসলাইন স্ট্যাটাস দেখান</b>
            <p className="dim" style={{ margin: '2px 0 0' }}>
              &quot;স্যার, আমাদের ড্যাশবোর্ড কোনো ফেক ডাটা দেখায় না। প্রথমে Overview পেজে দেখুন রিস্ক স্কোর ০ (SAFE), কোনো অননুমোদিত পোর্ট বা প্রসেস নেই এবং ব্যাকএন্ড সার্ভিস রিয়েলটাইমে অনলাইন।&quot;
            </p>
          </div>
          <div style={{ marginBottom: 10 }}>
            <b style={{ color: 'var(--c)' }}>ধাপ ২: লাইভ অ্যাটাক সিমুলেশন চালান</b>
            <p className="dim" style={{ margin: '2px 0 0' }}>
              &quot;এখন আমি Demo পেজ থেকে একটি ব্যাকডোর পোর্ট বা টেম্প ডিরেক্টরি থেকে সাসপিশিয়াস এক্সিকিউটেবল সিমুলেট করছি (যেমন: <b>Trigger port</b> বা <b>Trigger temp</b>)।&quot;
            </p>
          </div>
          <div style={{ marginBottom: 10 }}>
            <b style={{ color: 'var(--r)' }}>ধাপ ৩: ইনস্ট্যান্ট ডিটেকশন ও রিস্ক স্কোর বৃদ্ধি দেখান</b>
            <p className="dim" style={{ margin: '2px 0 0' }}>
              &quot;অ্যাটাক ট্রিগার করার পর Network বা Process পেজে স্ক্যান করলেই দেখতে পাবেন নতুন ব্যাকডোর পোর্টটি <b>NEW</b> ব্যাজসহ ধরা পড়েছে, রিস্ক স্কোর ২০ পয়েন্ট বেড়ে গেছে এবং Alerts পেজে MITRE রেফারেন্সসহ র-এভিডেন্স জমা হয়েছে।&quot;
            </p>
          </div>
          <div>
            <b style={{ color: 'var(--p)' }}>ধাপ ৪: সিস্টেম ক্লিনআপ ও রিসেট</b>
            <p className="dim" style={{ margin: '2px 0 0' }}>
              &quot;অবশেষে <b>Reset Lab</b> বাটনে ক্লিক করলে সিস্টেম স্বয়ংক্রিয়ভাবে ব্যাকডোর প্রসেস বন্ধ করে রিস্ক স্কোর আবার নিরাপদে (SAFE) ফিরিয়ে আনে।&quot;
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
