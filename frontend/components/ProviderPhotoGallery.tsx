'use client'

import { useEffect, useState } from 'react'
import { getNurseryPhotos } from '@/lib/api'
import type { NurseryPhoto } from '@/lib/api'

interface Props {
  urn: string
  nurseryName: string
}

export default function ProviderPhotoGallery({ urn, nurseryName }: Props) {
  const [photos, setPhotos] = useState<NurseryPhoto[]>([])
  const [selected, setSelected] = useState<NurseryPhoto | null>(null)

  useEffect(() => {
    getNurseryPhotos(urn).then(setPhotos)
  }, [urn])

  if (photos.length === 0) return null

  return (
    <div className="mb-6">
      <h2 className="font-semibold text-gray-900 mb-2">
        Photos by {nurseryName}
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {photos.map((photo) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setSelected(photo)}
            className="relative group focus:outline-none focus:ring-2 focus:ring-blue-400 rounded-lg overflow-hidden"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.public_url}
              alt={photo.caption || `${nurseryName} photo`}
              className="w-full h-32 object-cover rounded-lg border border-gray-200 group-hover:opacity-90 transition-opacity"
            />
            {photo.caption && (
              <span className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs px-2 py-1 truncate">
                {photo.caption}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="relative max-w-3xl max-h-[90vh] w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selected.public_url}
              alt={selected.caption || `${nurseryName} photo`}
              className="w-full max-h-[80vh] object-contain rounded-lg"
            />
            {selected.caption && (
              <p className="text-white text-sm text-center mt-2">{selected.caption}</p>
            )}
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="absolute top-2 right-2 bg-white/90 text-gray-800 rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold hover:bg-white"
            >
              X
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
