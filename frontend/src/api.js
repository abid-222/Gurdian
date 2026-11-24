export const getSessionToken = () => {
  try {
    return sessionStorage.getItem('guardian_session_token') || ''
  } catch {
    return ''
  }
}

export const setSessionToken = tok => {
  try {
    if (tok) sessionStorage.setItem('guardian_session_token', tok)
    else sessionStorage.removeItem('guardian_session_token')
  } catch {
    // Ignore storage errors
  }
}

export const api = (p, m = 'GET', body) => {
  const headers = {}
  if (body) headers['Content-Type'] = 'application/json'
  const sess = getSessionToken()
  if (sess) headers['X-Session-Token'] = sess
  return fetch(p, { method: m, headers: Object.keys(headers).length ? headers : undefined, body: body && JSON.stringify(body) })
    .then(async r => {
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || `${r.status} ${p}`)
      return r.json()
    })
}

api.get = p => api(p, 'GET')
api.post = (p, body) => api(p, 'POST', body)

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
  const blob = new Blob([[k.join(','), ...rows.map(r => k.map(c => q(r[c])).join(','))].join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { download: name, href: url })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
