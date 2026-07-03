import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './style.css'

import { exportGif, playReveal, revealTiming } from './animate'
import { PALETTES, randomComplementaryPair } from './colormap'
import { GALLERY } from './gallery'
import { reversePlace, searchPlace } from './geocode'
import { pngWithDpi } from './pngdpi'
import { buildModel, drawPrint, type PrintModel } from './render'
import { printToSvg } from './svg'
import { fetchTerrain } from './terrain'
import { ASPECT_HW, type Aspect, type RenderState, type TerrainGrid } from './types'
import { paramsToState, updateUrl } from './urlstate'

const DISPLAY_W = 1400
const EXPORT_DPI = 300
// Exports refetch terrain on a finer grid than the on-screen preview; where
// the tile sources have better-than-SRTM data (10m NED in the US, 25m EU-DEM
// in Europe) this pulls in genuinely more detail, not just smoother scaling.
const HQ_GRID_PX = 1600

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T

const canvas = $<HTMLCanvasElement>('#print')
const statusEl = $<HTMLDivElement>('#status')

const defaultState: RenderState = {
  lat: GALLERY[0].lat,
  lon: GALLERY[0].lon,
  extentKm: GALLERY[0].extentKm ?? 20,
  bands: 18,
  paletteId: GALLERY[0].paletteId ?? 'glacier',
  colorA: '',
  colorB: '',
  quantile: false,
  reverse: false,
  aspect: 'square',
  title: GALLERY[0].title ?? '',
}

let state: RenderState = paramsToState(new URLSearchParams(location.search), defaultState) ?? {
  ...defaultState,
}
applyPaletteColors(state)

let grid: TerrainGrid | null = null
let gridKey = ''
let model: PrintModel | null = null
let fetchToken = 0
let stopAnimation: (() => void) | null = null

function applyPaletteColors(s: RenderState): void {
  const pal = PALETTES.find((p) => p.id === s.paletteId)
  if (pal) {
    s.colorA = pal.a
    s.colorB = pal.b
  } else if (!s.colorA || !s.colorB) {
    s.paletteId = PALETTES[0].id
    s.colorA = PALETTES[0].a
    s.colorB = PALETTES[0].b
  }
}

function setStatus(msg: string, isError = false): void {
  statusEl.textContent = msg
  statusEl.className = isError ? 'error' : ''
}

function keyOf(s: RenderState): string {
  return [s.lat.toFixed(5), s.lon.toFixed(5), s.extentKm, s.aspect].join('|')
}

/** Re-render; fetches terrain only when location/extent/aspect changed. */
async function render(): Promise<void> {
  stopAnimation?.()
  stopAnimation = null

  const key = keyOf(state)
  if (key !== gridKey || !grid) {
    const token = ++fetchToken
    setStatus('Fetching terrain…')
    try {
      const g = await fetchTerrain(state.lat, state.lon, state.extentKm, state.aspect)
      if (token !== fetchToken) return // superseded by a newer request
      grid = g
      gridKey = key
    } catch (err) {
      if (token !== fetchToken) return
      setStatus(`Terrain fetch failed: ${err instanceof Error ? err.message : err}`, true)
      return
    }
  }

  model = buildModel(grid, state)
  drawPrint(canvas, model, DISPLAY_W)
  setStatus(
    `SRTM z${grid.zoom} · ${grid.width}×${grid.height} px · ${Math.round(grid.min)}–${Math.round(grid.max)} m`,
  )
  updateUrl(state)
  syncControls()
}

// --- Minimap ---

const map = L.map('minimap', { zoomControl: false, attributionControl: false }).setView(
  [state.lat, state.lon],
  9,
)
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 17 }).addTo(map)

const markerIcon = L.divIcon({ className: '', html: '<div class="marker-dot"></div>', iconSize: [14, 14], iconAnchor: [7, 7] })
const marker = L.marker([state.lat, state.lon], { icon: markerIcon, draggable: true }).addTo(map)
const extentRect = L.rectangle(extentBounds(state), {
  color: '#ff6b35',
  weight: 1,
  fill: false,
  interactive: false,
}).addTo(map)

function extentBounds(s: RenderState): L.LatLngTuple[] {
  const heightKm = s.extentKm * ASPECT_HW[s.aspect]
  const dLat = heightKm / 111.32 / 2
  const dLon = s.extentKm / (111.32 * Math.cos((s.lat * Math.PI) / 180)) / 2
  return [
    [s.lat - dLat, s.lon - dLon],
    [s.lat + dLat, s.lon + dLon],
  ]
}

async function setPoint(lat: number, lon: number, title?: string): Promise<void> {
  state.lat = lat
  state.lon = lon
  if (title !== undefined) state.title = title
  marker.setLatLng([lat, lon])
  map.panTo([lat, lon])
  void render()
  if (title === undefined) {
    // Fill in a place name once the reverse geocode returns.
    const name = await reversePlace(lat, lon)
    if (name && Math.abs(state.lat - lat) < 1e-9 && Math.abs(state.lon - lon) < 1e-9) {
      state.title = name
      if (model) drawPrint(canvas, model, DISPLAY_W)
      updateUrl(state)
      syncControls()
    }
  }
}

map.on('click', (e: L.LeafletMouseEvent) => void setPoint(e.latlng.lat, e.latlng.lng))
marker.on('dragend', () => {
  const p = marker.getLatLng()
  void setPoint(p.lat, p.lng)
})

// --- Search ---

const searchInput = $<HTMLInputElement>('#search')
const resultsList = $<HTMLUListElement>('#search-results')

searchInput.addEventListener('keydown', async (e) => {
  if (e.key !== 'Enter' || !searchInput.value.trim()) return
  setStatus('Searching…')
  try {
    const results = await searchPlace(searchInput.value.trim())
    resultsList.innerHTML = ''
    resultsList.hidden = results.length === 0
    setStatus(results.length ? '' : 'No results')
    for (const r of results) {
      const li = document.createElement('li')
      li.textContent = r.name
      li.addEventListener('click', () => {
        resultsList.hidden = true
        searchInput.value = ''
        void setPoint(r.lat, r.lon, r.name)
      })
      resultsList.appendChild(li)
    }
  } catch (err) {
    setStatus(`Search failed: ${err instanceof Error ? err.message : err}`, true)
  }
})

document.addEventListener('click', (e) => {
  if (!(e.target as HTMLElement).closest('.search-wrap')) resultsList.hidden = true
})

// --- Controls ---

const latInput = $<HTMLInputElement>('#lat')
const lonInput = $<HTMLInputElement>('#lon')
const titleInput = $<HTMLInputElement>('#title')
const extentSelect = $<HTMLSelectElement>('#extent')
const bandsInput = $<HTMLInputElement>('#bands')
const bandsValue = $<HTMLSpanElement>('#bands-value')
const colorAInput = $<HTMLInputElement>('#colorA')
const colorBInput = $<HTMLInputElement>('#colorB')
const quantileInput = $<HTMLInputElement>('#quantile')
const reverseInput = $<HTMLInputElement>('#reverse')

function syncControls(): void {
  latInput.value = state.lat.toFixed(4)
  lonInput.value = state.lon.toFixed(4)
  titleInput.value = state.title
  const extVal = String(state.extentKm)
  if (![...extentSelect.options].some((o) => o.value === extVal)) {
    const opt = document.createElement('option')
    opt.value = extVal
    opt.textContent = `${extVal} km`
    extentSelect.appendChild(opt)
  }
  extentSelect.value = extVal
  bandsInput.value = String(state.bands)
  bandsValue.textContent = String(state.bands)
  colorAInput.value = state.colorA
  colorBInput.value = state.colorB
  quantileInput.checked = state.quantile
  reverseInput.checked = state.reverse
  document.querySelectorAll<HTMLButtonElement>('.aspect').forEach((b) => {
    b.classList.toggle('selected', b.dataset.aspect === state.aspect)
  })
  document.querySelectorAll<HTMLButtonElement>('.palette-chip').forEach((b) => {
    b.classList.toggle('selected', b.dataset.palette === state.paletteId)
  })
  extentRect.setBounds(L.latLngBounds(extentBounds(state)))
}

const onCoordChange = () => {
  const lat = parseFloat(latInput.value)
  const lon = parseFloat(lonInput.value)
  if (isFinite(lat) && isFinite(lon)) void setPoint(lat, lon)
}
latInput.addEventListener('change', onCoordChange)
lonInput.addEventListener('change', onCoordChange)

titleInput.addEventListener('input', () => {
  state.title = titleInput.value
  if (model) drawPrint(canvas, model, DISPLAY_W)
  updateUrl(state)
})

extentSelect.addEventListener('change', () => {
  state.extentKm = parseFloat(extentSelect.value)
  void render()
})

bandsInput.addEventListener('input', () => {
  bandsValue.textContent = bandsInput.value
})
bandsInput.addEventListener('change', () => {
  state.bands = parseInt(bandsInput.value, 10)
  void render()
})

document.querySelectorAll<HTMLButtonElement>('.aspect').forEach((b) => {
  b.addEventListener('click', () => {
    state.aspect = b.dataset.aspect as Aspect
    void render()
  })
})

const paletteBox = $<HTMLDivElement>('#palettes')
for (const pal of PALETTES) {
  const b = document.createElement('button')
  b.className = 'palette-chip'
  b.dataset.palette = pal.id
  b.title = pal.name
  b.style.background = `linear-gradient(90deg, ${pal.a}, ${pal.b})`
  b.addEventListener('click', () => {
    state.paletteId = pal.id
    state.colorA = pal.a
    state.colorB = pal.b
    void render()
  })
  paletteBox.appendChild(b)
}

$<HTMLButtonElement>('#shuffle').addEventListener('click', () => {
  const { a, b } = randomComplementaryPair()
  state.paletteId = 'custom'
  state.colorA = a
  state.colorB = b
  void render()
})

const onCustomColor = () => {
  state.paletteId = 'custom'
  state.colorA = colorAInput.value
  state.colorB = colorBInput.value
  void render()
}
colorAInput.addEventListener('change', onCustomColor)
colorBInput.addEventListener('change', onCustomColor)

quantileInput.addEventListener('change', () => {
  state.quantile = quantileInput.checked
  void render()
})
reverseInput.addEventListener('change', () => {
  state.reverse = reverseInput.checked
  void render()
})

// --- Gallery ---

const galleryBox = $<HTMLDivElement>('#gallery')
for (const item of GALLERY) {
  const b = document.createElement('button')
  b.textContent = item.label
  b.addEventListener('click', () => {
    const { label: _label, ...preset } = item
    state = { ...state, ...preset }
    applyPaletteColors(state)
    marker.setLatLng([state.lat, state.lon])
    map.setView([state.lat, state.lon], 9)
    void render()
  })
  galleryBox.appendChild(b)
}

// --- Export & animate ---

const printSizeSelect = $<HTMLSelectElement>('#print-size')
const gifLoopSelect = $<HTMLSelectElement>('#gif-loop')
let hqGrid: TerrainGrid | null = null
let hqKey = ''

/** Model built on a high-res terrain grid, cached per location/extent/aspect. */
async function buildHqModel(): Promise<PrintModel> {
  const key = keyOf(state)
  if (key !== hqKey || !hqGrid) {
    setStatus('Fetching high-res terrain…')
    hqGrid = await fetchTerrain(state.lat, state.lon, state.extentKm, state.aspect, HQ_GRID_PX)
    hqKey = key
  }
  setStatus('Rendering…')
  // Let the status message paint before the heavy contour computation.
  await new Promise((r) => setTimeout(r, 20))
  return buildModel(hqGrid, state)
}

function download(blob: Blob, filename: string): void {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

function slug(): string {
  return (state.title || `${state.lat.toFixed(3)}_${state.lon.toFixed(3)}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

$<HTMLButtonElement>('#animate').addEventListener('click', () => {
  if (!model) return
  stopAnimation?.()
  const timing = revealTiming(parseFloat(gifLoopSelect.value), model.thresholds.length)
  stopAnimation = playReveal(canvas, model, DISPLAY_W, timing)
})

$<HTMLButtonElement>('#dl-png').addEventListener('click', async () => {
  if (!model) return
  try {
    const inches = parseInt(printSizeSelect.value, 10)
    const W = inches * EXPORT_DPI
    const hq = await buildHqModel()
    const out = document.createElement('canvas')
    drawPrint(out, hq, W)
    const raw = await new Promise<Blob>((resolve, reject) =>
      out.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas too large for this browser'))), 'image/png'),
    )
    download(await pngWithDpi(raw, EXPORT_DPI), `topoloco-${slug()}-${inches}in.png`)
    setStatus(`PNG saved · ${out.width}×${out.height} px · ${inches} in @ ${EXPORT_DPI} DPI`)
  } catch (err) {
    setStatus(`PNG export failed: ${err instanceof Error ? err.message : err}`, true)
  }
})

$<HTMLButtonElement>('#dl-svg').addEventListener('click', async () => {
  if (!model) return
  try {
    const inches = parseInt(printSizeSelect.value, 10)
    const hq = await buildHqModel()
    const svg = printToSvg(hq, 1600, inches)
    download(new Blob([svg], { type: 'image/svg+xml' }), `topoloco-${slug()}-${inches}in.svg`)
    setStatus(`SVG saved · ${inches} in wide`)
  } catch (err) {
    setStatus(`SVG export failed: ${err instanceof Error ? err.message : err}`, true)
  }
})

$<HTMLButtonElement>('#dl-gif').addEventListener('click', async () => {
  if (!model) return
  try {
    const timing = revealTiming(parseFloat(gifLoopSelect.value), model.thresholds.length)
    const blob = await exportGif(model, timing, 640, (done, total) =>
      setStatus(`Rendering GIF… ${done}/${total}`),
    )
    download(blob, `topoloco-${slug()}.gif`)
    const loopS = (timing.frameMs * model.thresholds.length + timing.holdMs) / 1000
    setStatus(`GIF saved · ${loopS.toFixed(1)} s per loop · ${(blob.size / 1e6).toFixed(1)} MB`)
  } catch (err) {
    setStatus(`GIF export failed: ${err instanceof Error ? err.message : err}`, true)
  }
})

$<HTMLButtonElement>('#share').addEventListener('click', async () => {
  updateUrl(state)
  await navigator.clipboard.writeText(location.href)
  setStatus('Link copied')
})

// --- Boot ---

syncControls()
void render()
