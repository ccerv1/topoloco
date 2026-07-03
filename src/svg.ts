import { cssColor } from './colormap'
import { formatCoords, INK, layoutPrint, PAPER, type PrintModel } from './render'

const MONO = 'ui-monospace, SF Mono, Menlo, monospace'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Standalone SVG of the full print — vector output suitable for physical
 * prints. `inches` sets the declared physical width so the file opens at
 * the intended print size.
 */
export function printToSvg(model: PrintModel, W = 1600, inches?: number): string {
  const L = layoutPrint(model, W)
  const { grid, polys, bandColor, state } = model
  const sx = L.plotW / grid.width
  const sy = L.plotH / grid.height
  const parts: string[] = []

  const size = inches
    ? `width="${inches}in" height="${((inches * L.H) / L.W).toFixed(2)}in"`
    : `width="${L.W.toFixed(0)}" height="${L.H.toFixed(0)}"`
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" ${size} viewBox="0 0 ${L.W.toFixed(0)} ${L.H.toFixed(0)}">`,
    `<rect width="100%" height="100%" fill="${PAPER}"/>`,
  )

  // Contour bands, clipped to the plot rect.
  parts.push(
    `<clipPath id="plot"><rect x="${L.plotX}" y="${L.plotY}" width="${L.plotW}" height="${L.plotH}"/></clipPath>`,
    `<g clip-path="url(#plot)">`,
    `<rect x="${L.plotX}" y="${L.plotY}" width="${L.plotW}" height="${L.plotH}" fill="${cssColor(bandColor(0))}"/>`,
  )
  for (let i = 1; i < polys.length; i++) {
    const d: string[] = []
    for (const polygon of polys[i].coordinates) {
      for (const ring of polygon) {
        d.push(
          `M${(L.plotX + ring[0][0] * sx).toFixed(1)} ${(L.plotY + ring[0][1] * sy).toFixed(1)}`,
        )
        for (let k = 1; k < ring.length; k++) {
          d.push(`L${(L.plotX + ring[k][0] * sx).toFixed(1)} ${(L.plotY + ring[k][1] * sy).toFixed(1)}`)
        }
        d.push('Z')
      }
    }
    if (d.length) parts.push(`<path d="${d.join('')}" fill="${cssColor(bandColor(i))}"/>`)
  }
  parts.push('</g>')
  parts.push(
    `<rect x="${L.plotX}" y="${L.plotY}" width="${L.plotW}" height="${L.plotH}" fill="none" stroke="${INK}" stroke-opacity="0.5" stroke-width="${Math.max(1, W / 1200)}"/>`,
  )

  // Footer text.
  parts.push(
    `<text x="${L.plotX}" y="${L.titleY}" font-family="${MONO}" font-size="${L.titleSize}" font-weight="700" fill="${INK}">${esc((state.title || 'TOPOLOCO').toUpperCase())}</text>`,
    `<text x="${L.plotX + L.plotW}" y="${L.titleY}" text-anchor="end" font-family="${MONO}" font-size="${L.metaSize}" fill="${INK}">${esc(formatCoords(state.lat, state.lon))}</text>`,
  )

  // Histogram + colormap strip.
  const bins = model.hist.counts.length
  const binW = L.plotW / bins
  const span = Math.max(grid.max - grid.min, 1e-9)
  for (let i = 0; i < bins; i++) {
    const v = grid.min + span * ((i + 0.5) / bins)
    const h = (model.hist.counts[i] / model.hist.peak) * L.histH
    if (h < 0.05) continue
    parts.push(
      `<rect x="${(L.plotX + i * binW).toFixed(1)}" y="${(L.histY + L.histH - h).toFixed(1)}" width="${(binW + 0.3).toFixed(1)}" height="${h.toFixed(1)}" fill="${cssColor(model.elevColor(v))}"/>`,
    )
  }

  const n = model.thresholds.length
  const stops: string[] = []
  for (let i = 0; i < n; i++) {
    const c = cssColor(bandColor(i))
    stops.push(
      `<stop offset="${((i / n) * 100).toFixed(2)}%" stop-color="${c}"/>`,
      `<stop offset="${(((i + 1) / n) * 100).toFixed(2)}%" stop-color="${c}"/>`,
    )
  }
  parts.push(
    `<defs><linearGradient id="cmap">${stops.join('')}</linearGradient></defs>`,
    `<rect x="${L.plotX}" y="${L.barY}" width="${L.plotW}" height="${L.barH}" fill="url(#cmap)"/>`,
  )

  const label = (x: number, anchor: string, text: string) =>
    `<text x="${x}" y="${L.labelY}" text-anchor="${anchor}" font-family="${MONO}" font-size="${L.labelSize}" fill="${INK}">${esc(text)}</text>`
  parts.push(
    label(L.plotX, 'start', `${Math.round(grid.min).toLocaleString('en-US')}`),
    label(L.plotX + L.plotW / 2, 'middle', 'ELEVATION (M)'),
    label(L.plotX + L.plotW, 'end', `${Math.round(grid.max).toLocaleString('en-US')}`),
    '</svg>',
  )
  return parts.join('\n')
}
