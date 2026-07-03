export interface GeocodeResult {
  name: string
  lat: number
  lon: number
}

const NOMINATIM = 'https://nominatim.openstreetmap.org'

function shortName(displayName: string): string {
  return displayName.split(',').slice(0, 2).join(',').trim()
}

export async function searchPlace(query: string): Promise<GeocodeResult[]> {
  const url = `${NOMINATIM}/search?format=jsonv2&limit=5&q=${encodeURIComponent(query)}`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`)
  const rows = (await res.json()) as { display_name: string; lat: string; lon: string }[]
  return rows.map((r) => ({
    name: shortName(r.display_name),
    lat: parseFloat(r.lat),
    lon: parseFloat(r.lon),
  }))
}

/** Best-effort short place name for a point; empty string on failure. */
export async function reversePlace(lat: number, lon: number): Promise<string> {
  try {
    const url = `${NOMINATIM}/reverse?format=jsonv2&zoom=10&lat=${lat}&lon=${lon}`
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return ''
    const row = (await res.json()) as { display_name?: string }
    return row.display_name ? shortName(row.display_name) : ''
  } catch {
    return ''
  }
}
