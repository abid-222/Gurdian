import AttackSimulator from '../components/AttackSimulator'

export default function Demo({ src }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <AttackSimulator src={src} />
    </div>
  )
}
