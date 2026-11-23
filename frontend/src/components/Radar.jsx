export default function Radar({ rows = [] }) {
  const getCoords = (r) => {
    const port = Number(r.local_port) || 0
    // Real Distance Mapping: Well-known ports (<1024) inside, Registered in mid, Ephemeral outside
    let d = 25
    if (port < 1024) {
      d = 22 + (port / 1024) * 20
    } else if (port < 49152) {
      d = 45 + ((port - 1024) / 48128) * 25
    } else {
      d = 72 + (Math.min(port - 49152, 16383) / 16383) * 20
    }
    // Real Angle Mapping: TCP top semi-circle (0-180deg), UDP bottom semi-circle (180-360deg)
    const isUdp = String(r.proto || '').toLowerCase().includes('udp')
    const baseAngle = isUdp ? Math.PI : 0
    const offset = ((port % 1000) / 1000) * Math.PI
    const a = baseAngle + offset
    return { x: d * Math.cos(a), y: d * Math.sin(a), d, a }
  }

  return (
    <div className="radar-box">
      <svg viewBox="-100 -100 200 200" className="radar">
        {/* Real Port Range Rings */}
        <circle r="42" fill="none" stroke="#1f6f3a" strokeWidth="0.8" strokeDasharray="3 3" />
        <circle r="70" fill="none" stroke="#1f6f3a" strokeWidth="0.8" strokeDasharray="3 3" />
        <circle r="92" fill="none" stroke="#1f6f3a" strokeWidth="1" />
        {/* Crosshair Axes */}
        <line x1="-95" y1="0" x2="95" y2="0" stroke="rgba(31,111,58,0.4)" strokeWidth="0.7" />
        <line x1="0" y1="-95" x2="0" y2="95" stroke="rgba(31,111,58,0.4)" strokeWidth="0.7" />
        {/* Rotating Radar Sweep */}
        <g className="sweep">
          <line x1="0" y1="0" x2="0" y2="-92" stroke="#3fb950" strokeWidth="1.5" />
        </g>
        {/* Real Sockets Plotted */}
        {rows.map((r, i) => {
          const { x, y } = getCoords(r)
          const isNew = r.status === 'NEW'
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={isNew ? '4' : '3'}
              fill={isNew ? 'var(--r)' : 'var(--g)'}
              stroke="#000"
              strokeWidth="0.5"
            >
              <title>{`${r.proto?.toUpperCase() || 'TCP'}/${r.local_port} (${r.process || 'unknown'}) [${r.status || 'KNOWN'}]`}</title>
            </circle>
          )
        })}
      </svg>
      <span className="dim" style={{ textAlign: 'center', maxWidth: 220, fontSize: 10 }}>
        <b>Port Geometry</b>: Distance = Port Range (Inner: &lt;1024, Mid: &lt;49K, Outer: &gt;49K) · Angle = TCP/UDP
      </span>
    </div>
  )
}
