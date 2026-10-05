import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { useStore } from '../store'
import { margeBas } from './marge'

/** Point bleu de la position courante. Au premier relevé, la carte s'y centre. */
export function MaPosition({ map }: { map: maplibregl.Map }) {
  const position = useStore((s) => s.position)
  const marqueur = useRef<maplibregl.Marker | null>(null)

  useEffect(() => {
    if (!position) {
      marqueur.current?.remove()
      marqueur.current = null
      return
    }
    const lngLat: [number, number] = [position.lon, position.lat]
    if (!marqueur.current) {
      const racine = document.createElement('div')
      const el = document.createElement('div')
      el.className = 'moi'
      racine.append(el)
      marqueur.current = new maplibregl.Marker({ element: racine }).setLngLat(lngLat).addTo(map)
      map.easeTo({ center: lngLat, zoom: Math.max(map.getZoom(), 17), padding: { bottom: margeBas(), top: 0, left: 0, right: 0 } })
    } else {
      marqueur.current.setLngLat(lngLat)
    }
  }, [map, position])

  useEffect(
    () => () => {
      marqueur.current?.remove()
      marqueur.current = null
    },
    [],
  )

  return null
}
