import { useState } from 'react'
import { Search, History, Save, Info, Usb as UsbIcon } from 'lucide-react'
import { api, saveBaseline } from '../api'
import { useScan } from '../hooks/useScan'
import { Badge, Btn, Card, ErrorBox, Table } from '../components/ui'

export default function Usb({ src }) {
  const { data, loading, error, run } = useScan('usb', src)
  const [hist, setHist] = useState(null)
  const [err, setErr] = useState('')

  const guard = f => async () => {
    try {
      await f()
    } catch (e) {
      setErr(e.message)
    }
  }

  return (
    <div>
      {/* ── 3D Security Module Banner ── */}
      <div className="status-banner-3d">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <UsbIcon size={22} color="var(--c)" />
              <h3 style={{ margin: 0, color: 'var(--fg)', fontSize: 16 }}>
                Physical Hardware Bus & USB Peripheral Sentinel
              </h3>
              <Badge v={data?.rows?.length > 0 ? `${data.rows.length} CONNECTED` : 'MONITORED'} tone="g" />
            </div>
            <p className="dim" style={{ fontSize: 13, margin: '4px 0 0', maxWidth: 740, lineHeight: 1.5 }}>
              Audits hardware buses and Plug-and-Play device trees for unauthorized external peripherals.
              Maintains an append-only forensic event history to protect against BadUSB, rubber ducky keystroke injectors, and data exfiltration.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="badge c" style={{ fontSize: 11, padding: '4px 10px' }}>
              Platform: {src.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <Btn onClick={run} loading={loading}>
          <Search size={14} /> Scan USB
        </Btn>
        <Btn
          onClick={guard(async () =>
            setHist(
              (await api('/api/history/usb')).items.map(i => ({
                ...i,
                first_seen: new Date(i.first_seen * 1000).toLocaleString(),
                last_seen: new Date(i.last_seen * 1000).toLocaleString()
              }))
            )
          )}
        >
          <History size={14} /> Show History
        </Btn>
        <Btn
          onClick={guard(async () => {
            await saveBaseline('usb', src)
            run()
          })}
        >
          <Save size={14} /> Save Baseline
        </Btn>
        <span className="dim" style={{ marginLeft: 'auto', fontSize: 12 }}>
          {data?.rows?.length || 0} connected peripheral devices
        </span>
      </div>

      <ErrorBox error={error || err} errors={data?.errors} />

      {data?.alerts.map((a, i) => (
        <div key={i} style={{ marginBottom: 6 }}>
          <Badge v={a.severity} /> {a.message}
        </div>
      ))}

      {src === 'linux' && data && !data.rows.length && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 14px',
            borderRadius: 8,
            background: 'rgba(56, 189, 248, 0.08)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            marginBottom: 14
          }}
        >
          <Info size={16} color="var(--c)" />
          <span className="dim" style={{ fontSize: 12 }}>
            WSL2 cannot see USB devices without usbipd (normal). Switch the source to windows or both.
          </span>
        </div>
      )}

      {/* ── Active USB Devices Table ── */}
      <Table
        rows={data?.rows}
        cols={['source', 'name', 'vendor_id', 'product_id', 'serial', 'first_seen', 'status']}
      />

      {hist && (
        <div style={{ marginTop: 16 }}>
          <Card title="USB history">
            <Table rows={hist} />
          </Card>
        </div>
      )}
    </div>
  )
}
