import { ASPECT_HW, type Aspect, type TerrainGrid } from './types'

// AWS Open Data terrain tiles ("Terrarium" encoding), global coverage,
// no API key. Elevation in meters = (R * 256 + G + B / 256) - 32768.
const TILE_SIZE = 256
const MAX_ZOOM = 15
const tileUrl = (z: number, x: number, y: number) =>
  `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`

const EARTH_MPP_Z0 = 156543.03392 // meters per pixel at equator, zoom 0

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

async function loadTile(z: number, x: number, y: number): Promise<ImageBitmap | null> {
  const n = 1 << z
  if (y < 0 || y >= n) return null // off the top/bottom of the world
  const wrappedX = ((x % n) + n) % n
  const res = await fetch(tileUrl(z, wrappedX, y))
  if (!res.ok) throw new Error(`Tile fetch failed (${res.status}) at z${z}/${wrappedX}/${y}`)
  return createImageBitmap(await res.blob())
}

/** Light separable box blur to soften SRTM noise before contouring. */
function boxBlur(values: Float64Array, w: number, h: number): Float64Array {
  const tmp = new Float64Array(values.length)
  const out = new Float64Array(values.length)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - 1)
      const x1 = Math.min(w - 1, x + 1)
      tmp[y * w + x] = (values[y * w + x0] + values[y * w + x] + values[y * w + x1]) / 3
    }
  }
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - 1)
    const y1 = Math.min(h - 1, y + 1)
    for (let x = 0; x < w; x++) {
      out[y * w + x] = (tmp[y0 * w + x] + tmp[y * w + x] + tmp[y1 * w + x]) / 3
    }
  }
  return out
}

/**
 * Fetch an elevation grid centered on (lat, lon) covering extentKm across,
 * assembled from Terrarium tiles at an automatically chosen zoom.
 */
export async function fetchTerrain(
  lat: number,
  lon: number,
  extentKm: number,
  aspect: Aspect,
  targetWidthPx = 800,
): Promise<TerrainGrid> {
  const latRad = (lat * Math.PI) / 180
  const extentM = extentKm * 1000

  const mppTarget = extentM / targetWidthPx
  const zoom = clamp(Math.round(Math.log2((EARTH_MPP_Z0 * Math.cos(latRad)) / mppTarget)), 1, MAX_ZOOM)
  const mpp = (EARTH_MPP_Z0 * Math.cos(latRad)) / 2 ** zoom

  const widthPx = Math.round(extentM / mpp)
  const heightPx = Math.round(widthPx * ASPECT_HW[aspect])

  // Center of the request in world pixel coordinates (Web Mercator).
  const worldPx = TILE_SIZE * 2 ** zoom
  const cx = ((lon + 180) / 360) * worldPx
  const cy = ((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * worldPx
  const x0 = Math.round(cx - widthPx / 2)
  const y0 = Math.round(cy - heightPx / 2)

  const txMin = Math.floor(x0 / TILE_SIZE)
  const txMax = Math.floor((x0 + widthPx - 1) / TILE_SIZE)
  const tyMin = Math.floor(y0 / TILE_SIZE)
  const tyMax = Math.floor((y0 + heightPx - 1) / TILE_SIZE)

  const canvas = document.createElement('canvas')
  canvas.width = widthPx
  canvas.height = heightPx
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!

  const jobs: Promise<void>[] = []
  for (let ty = tyMin; ty <= tyMax; ty++) {
    for (let tx = txMin; tx <= txMax; tx++) {
      jobs.push(
        loadTile(zoom, tx, ty).then((img) => {
          if (img) ctx.drawImage(img, tx * TILE_SIZE - x0, ty * TILE_SIZE - y0)
        }),
      )
    }
  }
  await Promise.all(jobs)

  const { data } = ctx.getImageData(0, 0, widthPx, heightPx)
  let values: Float64Array<ArrayBufferLike> = new Float64Array(widthPx * heightPx)
  let min = Infinity
  let max = -Infinity
  for (let i = 0; i < values.length; i++) {
    const v = data[i * 4] * 256 + data[i * 4 + 1] + data[i * 4 + 2] / 256 - 32768
    values[i] = v
    if (v < min) min = v
    if (v > max) max = v
  }

  values = boxBlur(values, widthPx, heightPx)

  return { values, width: widthPx, height: heightPx, min, max, metersPerPixel: mpp, zoom }
}
