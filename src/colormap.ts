export interface Palette {
  id: string
  name: string
  a: string // low-elevation color (dark base)
  b: string // high-elevation color (bright complement)
}

// Two-color complementary pairs in the spirit of the original prints.
export const PALETTES: Palette[] = [
  { id: 'magma', name: 'Magma', a: '#140A0F', b: '#FF6B35' },
  { id: 'glacier', name: 'Glacier', a: '#0A1F33', b: '#9BD1E5' },
  { id: 'alpenglow', name: 'Alpenglow', a: '#2B1B3D', b: '#FFB86B' },
  { id: 'rainforest', name: 'Rainforest', a: '#0B2A1D', b: '#C6E377' },
  { id: 'desert', name: 'Desert', a: '#3A2618', b: '#F2C879' },
  { id: 'reef', name: 'Reef', a: '#002A32', b: '#FF8C61' },
  { id: 'midnight', name: 'Midnight', a: '#10131F', b: '#E0D68A' },
  { id: 'ember', name: 'Ember', a: '#23120B', b: '#E5533C' },
  { id: 'moss', name: 'Moss', a: '#1A2B1F', b: '#E9C46A' },
  { id: 'fjord', name: 'Fjord', a: '#16324F', b: '#F6E7CB' },
  { id: 'orchid', name: 'Orchid', a: '#251133', b: '#7FD8BE' },
  { id: 'coral', name: 'Ink & Coral', a: '#0F1B2D', b: '#FF6F91' },
]

export type RGB = [number, number, number]

export function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

export function rgbToHex([r, g, b]: RGB): string {
  const c = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

// --- OkLab interpolation (perceptually smooth two-color ramps) ---

function srgbToLinear(c: number): number {
  c /= 255
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

function linearToSrgb(c: number): number {
  return 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)
}

function rgbToOklab([r, g, b]: RGB): [number, number, number] {
  const lr = srgbToLinear(r)
  const lg = srgbToLinear(g)
  const lb = srgbToLinear(b)
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

function oklabToRgb([L, A, B]: [number, number, number]): RGB {
  const l = Math.pow(L + 0.3963377774 * A + 0.2158037573 * B, 3)
  const m = Math.pow(L - 0.1055613458 * A - 0.0638541728 * B, 3)
  const s = Math.pow(L - 0.0894841775 * A - 1.291485548 * B, 3)
  return [
    linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ]
}

/** Linear segmented colormap between two colors, interpolated in OkLab. */
export function makeColormap(colorA: string, colorB: string): (t: number) => RGB {
  const a = rgbToOklab(hexToRgb(colorA))
  const b = rgbToOklab(hexToRgb(colorB))
  return (t: number) => {
    t = Math.max(0, Math.min(1, t))
    return oklabToRgb([
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
    ])
  }
}

export function cssColor([r, g, b]: RGB): string {
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`
}

function hslToHex(h: number, s: number, l: number): string {
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return rgbToHex([f(0) * 255, f(8) * 255, f(4) * 255])
}

/** A random dark base plus a bright near-complementary color. */
export function randomComplementaryPair(): { a: string; b: string } {
  const h = Math.random() * 360
  const jitter = Math.random() * 40 - 20
  return {
    a: hslToHex(h, 0.35 + Math.random() * 0.3, 0.1 + Math.random() * 0.12),
    b: hslToHex((h + 180 + jitter + 360) % 360, 0.55 + Math.random() * 0.35, 0.55 + Math.random() * 0.2),
  }
}
