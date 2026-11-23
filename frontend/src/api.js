export const api = (p, m = 'GET', body) =>
  fetch(p, { method: m, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body && JSON.stringify(body) })
    .then(async r => { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || `${r.status} ${p}`); return r.json() })

export const sources = src => (src === 'both' ? ['windows', 'linux'] : [src])

export const saveBaseline = async (mod, src) => {
  const list = sources(src)
  const results = await Promise.allSettled(list.map(s => api(`/api/baseline/${mod}?source=${s}`, 'POST')))
  const passed = results.filter(r => r.status === 'fulfilled').map(r => r.value)
  if (passed.length === 0) {
    const err = results.find(r => r.status === 'rejected')?.reason?.message
    throw new Error(err || 'Failed to save baseline')
  }
  return passed
}

export const toCsv = (rows, name) => {
  if (!rows?.length) return
  const k = Object.keys(rows[0]), q = v => `"${String(v ?? '').replace(/"/g, '""')}"`
  Object.assign(document.createElement('a'), { download: name, href: URL.createObjectURL(new Blob([[k.join(','), ...rows.map(r => k.map(c => q(r[c])).join(','))].join('\n')], { type: 'text/csv' })) }).click()
}
