# Topoloco

Web version of the [Topoloco project](https://cerv.one/essays/topoloco.html): drop a GPS
point anywhere on Earth and get a topographic art print with a custom two-color colormap.

Fully client-side — no backend, no API keys.

## How it works

1. **Elevation** — [AWS Open Data Terrain Tiles](https://registry.opendata.aws/terrain-tiles/)
   ("Terrarium" PNGs, NASA SRTM 30m + other sources merged). Elevation is decoded from RGB:
   `(R × 256 + G + B / 256) − 32768`. Tiles are fetched around the point at an auto-chosen
   zoom and assembled into an elevation grid (`src/terrain.ts`).
2. **Contours** — `d3-contour` (marching squares) produces filled contour bands
   (`src/contours.ts`). Linear or quantile thresholds — quantile mode is the fix for
   bimodal elevation distributions (e.g. the Semien Mountains).
3. **Colormap** — two complementary colors interpolated in OkLab (`src/colormap.ts`),
   with preset palettes and a random-complementary-pair shuffle.
4. **Print** — canvas render with the signature footer (title, coords, elevation
   histogram over the colormap strip) in `src/render.ts`; mirrored SVG export in
   `src/svg.ts` for physical prints.
5. **Animation** — progressive contour reveal, exportable as GIF via `gifenc`
   (`src/animate.ts`).

Geocoding (search + reverse) uses the free Nominatim API; the minimap is Leaflet + OSM.
Every render state round-trips through the URL query string (`src/urlstate.ts`), so any
print is shareable as a link.

## Original Python version (2021)

The web app supersedes the original matplotlib pipeline, which lives on in
[`python/`](python/): `build_dem.py` downloads a GeoTIFF DEM for a
`NAME/LAT,LON,ZOOM` location and writes a metadata JSON (colors, radius,
contour levels, output type), then `art.py` renders the print or GIF from it.

## Develop

```sh
npm install
npm run dev
```

## Deploy

```sh
npm run build
```

`dist/` is a fully static bundle with relative asset paths (`base: './'`) — copy it to any
static host or subpath, e.g. `cerv.one/topoloco/`.
