import type { ContourMultiPolygon } from 'd3-contour'
import { cssColor, makeColormap, type RGB } from './colormap'
import { computeContours, computeThresholds } from './contours'
import type { RenderState, TerrainGrid } from './types'

export const PAPER = '#FAF7F0'
export const INK = '#221F1A'
const HIST_BINS = 72

export interface PrintModel {
  grid: TerrainGrid
  state: RenderState
  thresholds: number[]
  polys: ContourMultiPolygon[]
  bandColor: (band: number) => RGB
  elevColor: (v: number) => RGB
  hist: { counts: number[]; peak: number }
}

export function buildModel(grid: TerrainGrid, state: RenderState): PrintModel {
  const thresholds = computeThresholds(grid, state.bands, state.quantile)
  const polys = computeContours(grid, thresholds)
  const cmap = makeColormap(state.colorA, state.colorB)
  const n = thresholds.length
  const bandColor = (band: number) => {
    const t = n <= 1 ? 0 : band / (n - 1)
    return cmap(state.reverse ? 1 - t : t)
  }
  const bandOf = (v: number) => {
    let band = 0
    for (let i = n - 1; i >= 0; i--) {
      if (v >= thresholds[i]) {
        band = i
        break
      }
    }
    return band
  }
  const elevColor = (v: number) => bandColor(bandOf(v))

  const counts = new Array(HIST_BINS).fill(0)
  const { values, min, max } = grid
  const span = Math.max(max - min, 1e-9)
  const step = Math.max(1, Math.floor(values.length / 200_000))
  for (let i = 0; i < values.length; i += step) {
    const bin = Math.min(HIST_BINS - 1, Math.floor(((values[i] - min) / span) * HIST_BINS))
    counts[bin]++
  }
  const peak = Math.max(...counts, 1)

  return { grid, state, thresholds, polys, bandColor, elevColor, hist: { counts, peak } }
}

// --- Layout shared by canvas renderer and SVG export ---

export interface PrintLayout {
  W: number
  H: number
  margin: number
  plotX: number
  plotY: number
  plotW: number
  plotH: number
  titleY: number
  titleSize: number
  metaSize: number
  histY: number
  histH: number
  barY: number
  barH: number
  labelY: number
  labelSize: number
}

export function layoutPrint(model: PrintModel, W: number): PrintLayout {
  const { grid } = model
  const margin = 0.06 * W
  const plotW = W - 2 * margin
  const plotH = plotW * (grid.height / grid.width)
  const gap = 0.05 * W
  const titleSize = 0.021 * W
  const metaSize = 0.0135 * W
  const titleY = margin + plotH + gap + titleSize
  const histY = titleY + 0.022 * W
  const histH = 0.055 * W
  const barY = histY + histH + 0.004 * W
  const barH = 0.013 * W
  const labelSize = 0.0115 * W
  const labelY = barY + barH + 0.008 * W + labelSize
  const H = labelY + margin * 0.9
  return {
    W, H, margin,
    plotX: margin, plotY: margin, plotW, plotH,
    titleY, titleSize, metaSize,
    histY, histH, barY, barH, labelY, labelSize,
  }
}

export function formatCoords(lat: number, lon: number): string {
  const f = (v: number, pos: string, neg: string) =>
    `${Math.abs(v).toFixed(4)}° ${v >= 0 ? pos : neg}`
  return `${f(lat, 'N', 'S')}  ${f(lon, 'E', 'W')}`
}

export function formatRange(min: number, max: number): string {
  const f = (v: number) => Math.round(v).toLocaleString('en-US')
  return `${f(min)} – ${f(max)} M`
}

function mono(px: number, weight = 500): string {
  return `${weight} ${px}px ui-monospace, "SF Mono", Menlo, monospace`
}

/**
 * Draw the full print onto a canvas. `revealUpTo` limits how many bands are
 * drawn (for the progressive-reveal animation); Infinity draws everything.
 */
export function drawPrint(
  canvas: HTMLCanvasElement,
  model: PrintModel,
  W: number,
  revealUpTo = Infinity,
): PrintLayout {
  const L = layoutPrint(model, W)
  canvas.width = Math.round(L.W)
  canvas.height = Math.round(L.H)
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, L.W, L.H)

  // --- Contour plot ---
  const { grid, polys, bandColor } = model
  const sx = L.plotW / grid.width
  const sy = L.plotH / grid.height

  ctx.save()
  ctx.beginPath()
  ctx.rect(L.plotX, L.plotY, L.plotW, L.plotH)
  ctx.clip()

  const upTo = Math.min(polys.length - 1, revealUpTo)
  for (let i = 0; i <= upTo; i++) {
    ctx.fillStyle = cssColor(bandColor(i))
    if (i === 0) {
      // Base band always covers the full plot.
      ctx.fillRect(L.plotX, L.plotY, L.plotW, L.plotH)
      continue
    }
    ctx.beginPath()
    for (const polygon of polys[i].coordinates) {
      for (const ring of polygon) {
        ctx.moveTo(L.plotX + ring[0][0] * sx, L.plotY + ring[0][1] * sy)
        for (let k = 1; k < ring.length; k++) {
          ctx.lineTo(L.plotX + ring[k][0] * sx, L.plotY + ring[k][1] * sy)
        }
        ctx.closePath()
      }
    }
    ctx.fill()
  }
  ctx.restore()

  ctx.strokeStyle = INK
  ctx.globalAlpha = 0.5
  ctx.lineWidth = Math.max(1, W / 1200)
  ctx.strokeRect(L.plotX, L.plotY, L.plotW, L.plotH)
  ctx.globalAlpha = 1

  // --- Footer: title + coords ---
  const { state } = model
  ctx.fillStyle = INK
  ctx.font = mono(L.titleSize, 700)
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  ctx.fillText((state.title || 'TOPOLOCO').toUpperCase(), L.plotX, L.titleY)

  ctx.font = mono(L.metaSize)
  ctx.textAlign = 'right'
  ctx.fillText(formatCoords(state.lat, state.lon), L.plotX + L.plotW, L.titleY)
  ctx.textAlign = 'left'

  // --- Footer: histogram over colormap strip ---
  const bins = model.hist.counts.length
  const binW = L.plotW / bins
  const span = Math.max(grid.max - grid.min, 1e-9)
  for (let i = 0; i < bins; i++) {
    const v = grid.min + span * ((i + 0.5) / bins)
    const h = (model.hist.counts[i] / model.hist.peak) * L.histH
    ctx.fillStyle = cssColor(model.elevColor(v))
    ctx.fillRect(L.plotX + i * binW, L.histY + L.histH - h, Math.ceil(binW), h)
  }

  const strips = 200
  const stripW = L.plotW / strips
  for (let i = 0; i < strips; i++) {
    const v = grid.min + span * ((i + 0.5) / strips)
    ctx.fillStyle = cssColor(model.elevColor(v))
    ctx.fillRect(L.plotX + i * stripW, L.barY, Math.ceil(stripW), L.barH)
  }

  // --- Footer: labels ---
  ctx.fillStyle = INK
  ctx.font = mono(L.labelSize)
  ctx.fillText(`${Math.round(grid.min).toLocaleString('en-US')}`, L.plotX, L.labelY)
  ctx.textAlign = 'center'
  ctx.fillText('ELEVATION (M)', L.plotX + L.plotW / 2, L.labelY)
  ctx.textAlign = 'right'
  ctx.fillText(`${Math.round(grid.max).toLocaleString('en-US')}`, L.plotX + L.plotW, L.labelY)
  ctx.textAlign = 'left'

  return L
}
