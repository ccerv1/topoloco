import { applyPalette, GIFEncoder, quantize } from 'gifenc'
import { drawPrint, type PrintModel } from './render'

export interface RevealTiming {
  frameMs: number
  holdMs: number
}

/**
 * Timing for a reveal that completes one loop in `loopSeconds`: the reveal
 * spreads over the bands, then the finished print holds before repeating.
 * GIF frame delays below ~30ms get clamped upward by browsers, so that's
 * the floor.
 */
export function revealTiming(loopSeconds: number, bands: number): RevealTiming {
  const holdMs = Math.min(1500, loopSeconds * 1000 * 0.3)
  const frameMs = Math.max(30, (loopSeconds * 1000 - holdMs) / bands)
  return { frameMs, holdMs }
}

/**
 * Play the progressive contour reveal on the given canvas.
 * Returns a cancel function.
 */
export function playReveal(
  canvas: HTMLCanvasElement,
  model: PrintModel,
  W: number,
  timing: RevealTiming,
): () => void {
  const bands = model.thresholds.length
  let cancelled = false
  let band = 0
  let last = performance.now()

  const tick = (now: number) => {
    if (cancelled) return
    if (now - last >= timing.frameMs) {
      last = now
      drawPrint(canvas, model, W, band)
      band++
      if (band >= bands) {
        drawPrint(canvas, model, W)
        return
      }
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
  return () => {
    cancelled = true
  }
}

/** Render the reveal animation to an animated GIF blob. */
export async function exportGif(
  model: PrintModel,
  timing: RevealTiming,
  width = 640,
  onProgress?: (done: number, total: number) => void,
): Promise<Blob> {
  const bands = model.thresholds.length
  const canvas = document.createElement('canvas')
  const gif = GIFEncoder()

  // Build one global palette from the final (most colorful) frame so colors
  // stay stable across frames.
  drawPrint(canvas, model, width)
  const ctx = canvas.getContext('2d')!
  const finalFrame = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const palette = quantize(finalFrame.data, 256)

  for (let band = 0; band < bands; band++) {
    drawPrint(canvas, model, width, band)
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
    gif.writeFrame(applyPalette(data, palette), canvas.width, canvas.height, {
      palette,
      delay: timing.frameMs,
    })
    onProgress?.(band + 1, bands + 1)
    // Yield so the UI can update between frames.
    await new Promise((r) => setTimeout(r, 0))
  }

  drawPrint(canvas, model, width)
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  gif.writeFrame(applyPalette(data, palette), canvas.width, canvas.height, {
    palette,
    delay: timing.holdMs,
  })
  onProgress?.(bands + 1, bands + 1)

  gif.finish()
  return new Blob([gif.bytes()], { type: 'image/gif' })
}
