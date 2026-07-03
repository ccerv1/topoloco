export type Aspect = 'square' | 'portrait' | 'landscape'

export interface RenderState {
  lat: number
  lon: number
  extentKm: number
  bands: number
  paletteId: string // id from PALETTES, or 'custom'
  colorA: string
  colorB: string
  quantile: boolean
  reverse: boolean
  aspect: Aspect
  title: string
}

export interface TerrainGrid {
  values: Float64Array<ArrayBufferLike>
  width: number
  height: number
  min: number
  max: number
  metersPerPixel: number
  zoom: number
}

/** Aspect ratio as height/width of the plot area. */
export const ASPECT_HW: Record<Aspect, number> = {
  square: 1,
  portrait: 3 / 2,
  landscape: 2 / 3,
}
