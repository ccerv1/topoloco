import type { Aspect, RenderState } from './types'

const ASPECTS: Aspect[] = ['square', 'portrait', 'landscape']

export function stateToParams(s: RenderState): URLSearchParams {
  const p = new URLSearchParams()
  p.set('lat', s.lat.toFixed(5))
  p.set('lon', s.lon.toFixed(5))
  p.set('ext', String(s.extentKm))
  p.set('bands', String(s.bands))
  p.set('pal', s.paletteId)
  if (s.paletteId === 'custom') {
    p.set('ca', s.colorA.replace('#', ''))
    p.set('cb', s.colorB.replace('#', ''))
  }
  if (s.quantile) p.set('q', '1')
  if (s.reverse) p.set('rev', '1')
  if (s.aspect !== 'square') p.set('asp', s.aspect)
  if (s.title) p.set('t', s.title)
  return p
}

export function paramsToState(p: URLSearchParams, base: RenderState): RenderState | null {
  const lat = parseFloat(p.get('lat') ?? '')
  const lon = parseFloat(p.get('lon') ?? '')
  if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 85 || Math.abs(lon) > 180) return null

  const s: RenderState = { ...base, lat, lon }
  const ext = parseFloat(p.get('ext') ?? '')
  if (isFinite(ext) && ext >= 1 && ext <= 200) s.extentKm = ext
  const bands = parseInt(p.get('bands') ?? '', 10)
  if (isFinite(bands) && bands >= 4 && bands <= 40) s.bands = bands
  const pal = p.get('pal')
  if (pal) s.paletteId = pal
  const ca = p.get('ca')
  const cb = p.get('cb')
  if (ca && /^[0-9a-fA-F]{6}$/.test(ca)) s.colorA = `#${ca}`
  if (cb && /^[0-9a-fA-F]{6}$/.test(cb)) s.colorB = `#${cb}`
  s.quantile = p.get('q') === '1'
  s.reverse = p.get('rev') === '1'
  const asp = p.get('asp') as Aspect | null
  if (asp && ASPECTS.includes(asp)) s.aspect = asp
  s.title = p.get('t') ?? ''
  return s
}

export function updateUrl(s: RenderState): void {
  const url = `${location.pathname}?${stateToParams(s)}`
  history.replaceState(null, '', url)
}
