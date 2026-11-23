export const api = (p, m = 'GET', body) =>
  fetch(p, { method: m, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body && JSON.stringify(body) })
    .then(async r => { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || `${r.status} ${p}`); return r.json() })
export const sources = src => (src === 'both' ? ['linux', 'windows'] : [src])
export const saveBaseline = (mod, src) => Promise.all(sources(src).map(s => api(`/api/baseline/${mod}?source=${s}`, 'POST')))
export const toCsv = (rows, name) => {
  if (!rows?.length) return
  const k = Object.keys(rows[0]), q = v => `"${String(v ?? '').replace(/"/g, '""')}"`
  Object.assign(document.createElement('a'), { download: name, href: URL.createObjectURL(new Blob([[k.join(','), ...rows.map(r => k.map(c => q(r[c])).join(','))].join('\n')], { type: 'text/csv' })) }).click()
}
