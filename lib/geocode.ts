export type Coordinates = { lat: number; lng: number };

// Nominatim's usage policy requires a descriptive User-Agent identifying
// the calling application — a request with the default fetch() User-Agent
// gets a flat 403 "Access denied", found live while debugging why a
// city-only geocode (no ZIP on file) was silently returning null.
// Zippopotam doesn't enforce this today, but setting it there too is
// cheap and keeps both calls identifiable if that ever changes.
const GEOCODE_USER_AGENT = "ServeFinder/1.0 (+https://servefinder-app.vercel.app)";

// Zippopotam.us: free, keyless, US ZIP -> lat/lng lookup.
async function geocodeZip(zip: string): Promise<Coordinates | null> {
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${encodeURIComponent(zip)}`, {
      headers: { "User-Agent": GEOCODE_USER_AGENT },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const place = data.places?.[0];
    if (!place) return null;
    return { lat: parseFloat(place.latitude), lng: parseFloat(place.longitude) };
  } catch {
    return null;
  }
}

// Nominatim (OpenStreetMap): free, keyless, city-name geocoding used only
// as a fallback when the student has no ZIP on file. Their usage policy
// caps this at ~1 request/second, which is fine for a single lookup per
// dashboard load — don't call this in a loop.
async function geocodeCity(city: string): Promise<Coordinates | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=${encodeURIComponent(
        city
      )}`,
      { headers: { "User-Agent": GEOCODE_USER_AGENT } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const place = data[0];
    if (!place) return null;
    return { lat: parseFloat(place.lat), lng: parseFloat(place.lon) };
  } catch {
    return null;
  }
}

// ZIP centroids are more precise than city-name lookups, so prefer it;
// fall back to city only when no ZIP is on file.
export async function geocodeStudentLocation(
  zip: string | null,
  city: string | null
): Promise<Coordinates | null> {
  if (zip) {
    const byZip = await geocodeZip(zip);
    if (byZip) return byZip;
  }
  if (city) {
    return geocodeCity(city);
  }
  return null;
}
