export default function Radar({ rows }) {
  const h = s => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)
  return <svg viewBox="-100 -100 200 200" className="radar">{[30, 60, 90].map(r => <circle key={r} r={r} fill="none" stroke="#1f6f3a" />)}<g className="sweep"><line x2="0" y2="-95" /></g>
    {rows.map((r, i) => { const a = (h(r.proto + r.local_port) % 360) * Math.PI / 180, d = 25 + h(String(r.local_port)) % 65
      return <circle key={i} cx={d * Math.cos(a)} cy={d * Math.sin(a)} r="3.5" fill={r.status === 'NEW' ? 'var(--r)' : 'var(--g)'}><title>{r.proto}/{r.local_port} {r.process}</title></circle> })}</svg>
}
