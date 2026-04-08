# Travel time & isochrones

NurseryFinder uses the free **OSRM public demo server** at
`https://router.project-osrm.org` for routing. No API key is required.
Override with `OSRM_URL` env var to self-host.

## Backend

- `backend/src/services/travelTime.js`
  - `getTravelTime({fromLat, fromLng, toLat, toLng, mode})` — single route,
    cached in `travel_time_cache`, falls back to haversine if OSRM is down.
  - `getTravelMatrix({from, to, mode})` — batch via OSRM Table API.
  - Rate-limited to 1 request every 200ms in-process.
  - Modes: `walk` → `foot`, `cycle` → `bike`, `drive` → `car`.
- `backend/src/routes/travel.js`
  - `POST /api/v1/travel/time` — body `{from, to, mode}` where each endpoint is
    `{lat,lng}`, `{postcode}` or `{urn}`.
  - `POST /api/v1/travel/isochrone` — body `{from, durations_min, mode}`
    returns a GeoJSON FeatureCollection of octagon-hull polygons per band.

## Frontend

- `frontend/components/MapLibreMap.tsx` — generic MapLibre wrapper (markers,
  polygons, optional radius circle). Replaces all previous Leaflet usage.
- `frontend/components/PostcodeAutocomplete.tsx` — debounced UK postcode +
  place autocomplete using `api.postcodes.io`.
- `frontend/components/TravelTimePanel.tsx` — rendered on nursery profile
  pages; calculates walk/cycle/drive from home, destination, or custom
  postcode.
- Search page (`app/search/page.tsx`) has a travel-time filter that refines
  the top 20 results.
- Find-an-area page (`app/find-an-area/page.tsx`) has a "commute zones"
  toggle rendering isochrones at 15/30/45/60 min.
- The assistant supports a `commute` criterion (`{to_postcode, max_minutes,
  mode}`) which is batched via the OSRM Table API during district scoring.

## Gotchas

- The public OSRM demo has aggressive rate limits and no SLA; production
  deployments should self-host OSRM via Docker and set `OSRM_URL`.
- We only support walk/cycle/drive profiles. "Train", "transit" and "tube"
  phrases in assistant prompts are mapped to `drive` and surfaced with a note.
- Isochrones are computed by sampling a 20x20 grid and taking an octagon hull
  of reachable cells — not a precise true isochrone, but fast and free.
