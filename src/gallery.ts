import type { RenderState } from './types'

export interface GalleryItem extends Partial<RenderState> {
  label: string
  lat: number
  lon: number
}

// The spots from the original essay, plus their palettes as good defaults.
export const GALLERY: GalleryItem[] = [
  {
    label: 'Yosemite',
    title: 'Yosemite Valley',
    lat: 37.7456,
    lon: -119.5936,
    extentKm: 80,
    paletteId: 'glacier',
  },
  {
    label: 'Nyiragongo',
    title: 'Nyiragongo',
    lat: -1.5218,
    lon: 29.2494,
    extentKm: 20,
    paletteId: 'magma',
  },
  {
    label: 'Mauna Kea',
    title: 'Mauna Kea',
    lat: 19.8207,
    lon: -155.4681,
    extentKm: 60,
    paletteId: 'reef',
  },
  {
    label: 'Rift Valley',
    title: 'Great Rift Valley',
    lat: 7.95,
    lon: 38.7,
    extentKm: 80,
    paletteId: 'desert',
  },
  {
    label: 'Semien Mtns',
    title: 'Semien Mountains',
    lat: 13.2333,
    lon: 38.3667,
    extentKm: 150,
    paletteId: 'moss',
    quantile: true, // the bimodal-distribution fix, per the essay
  },
]
