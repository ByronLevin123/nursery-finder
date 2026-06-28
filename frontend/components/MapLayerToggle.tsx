'use client'

import { useCallback } from 'react'

export interface MapLayer {
  id: string
  emoji: string
  label: string
  defaultOn?: boolean
}

export const DEFAULT_LAYERS: MapLayer[] = [
  { id: 'nurseries', emoji: '\u{1F476}', label: 'Nurseries', defaultOn: true },
  { id: 'schools', emoji: '\u{1F3EB}', label: 'Schools' },
  { id: 'parks', emoji: '\u{1F333}', label: 'Parks' },
  { id: 'activities', emoji: '⭐', label: 'Activities' },
]

interface Props {
  layers?: MapLayer[]
  active: Record<string, boolean>
  onChange: (active: Record<string, boolean>) => void
}

export default function MapLayerToggle({
  layers = DEFAULT_LAYERS,
  active,
  onChange,
}: Props) {
  const toggleLayer = useCallback(
    (id: string) => {
      onChange({ ...active, [id]: !active[id] })
    },
    [active, onChange]
  )

  return (
    <div className="absolute top-3 left-3 z-10 flex flex-wrap gap-1.5">
      {layers.map((layer) => {
        const isActive = !!active[layer.id]
        return (
          <button
            key={layer.id}
            onClick={() => toggleLayer(layer.id)}
            className={`px-2.5 py-1 text-xs font-medium rounded-full shadow-sm border transition ${
              isActive
                ? 'bg-white border-blue-500 text-blue-700'
                : 'bg-white/80 border-gray-200 text-gray-500'
            }`}
            aria-pressed={isActive}
            title={`${isActive ? 'Hide' : 'Show'} ${layer.label}`}
          >
            {layer.emoji} {layer.label}
          </button>
        )
      })}
    </div>
  )
}
