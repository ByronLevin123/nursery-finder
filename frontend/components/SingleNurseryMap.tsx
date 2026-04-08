'use client'

import MapLibreMap from './MapLibreMap'

interface Props {
  lat: number
  lng: number
  name: string
}

export default function SingleNurseryMap({ lat, lng, name }: Props) {
  return (
    <MapLibreMap
      center={[lng, lat]}
      zoom={15}
      scrollZoom={false}
      markers={[
        {
          lat,
          lng,
          color: '#3b82f6',
          radius: 10,
          popupHtml: `<div style="font-size:13px;font-family:system-ui,sans-serif"><strong>${name}</strong></div>`,
        },
      ]}
    />
  )
}
