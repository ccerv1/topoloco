import { contours, type ContourMultiPolygon } from 'd3-contour'
import type { TerrainGrid } from './types'

/**
 * Band thresholds from low to high. The first threshold sits at the grid
 * minimum so band 0 fills the whole plot. Quantile mode spaces thresholds
 * by elevation percentile — the fix for bimodal distributions where linear
 * spacing wastes most of the colormap on empty elevation ranges.
 */
export function computeThresholds(grid: TerrainGrid, bands: number, quantile: boolean): number[] {
  let { min, max } = grid
  if (max - min < 5) {
    // Nearly flat (open ocean, salt flats): stretch so contouring still works.
    const mid = (min + max) / 2
    min = mid - 2.5
    max = mid + 2.5
  }

  if (!quantile) {
    return Array.from({ length: bands }, (_, i) => min + ((max - min) * i) / bands)
  }

  // Sample the grid (it can be ~1M cells) and take evenly spaced quantiles.
  const step = Math.max(1, Math.floor(grid.values.length / 50_000))
  const sample: number[] = []
  for (let i = 0; i < grid.values.length; i += step) sample.push(grid.values[i])
  sample.sort((a, b) => a - b)

  const thresholds: number[] = []
  let prev = -Infinity
  for (let i = 0; i < bands; i++) {
    const q = sample[Math.floor((sample.length - 1) * (i / bands))]
    // Keep thresholds strictly increasing even when quantiles collide.
    const t = Math.max(q, prev + 0.01)
    thresholds.push(t)
    prev = t
  }
  return thresholds
}

export function computeContours(grid: TerrainGrid, thresholds: number[]): ContourMultiPolygon[] {
  return contours()
    .size([grid.width, grid.height])
    .smooth(true)
    .thresholds(thresholds)(grid.values as unknown as number[])
}
