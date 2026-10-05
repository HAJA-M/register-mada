import { useCallback, useEffect, useRef } from 'react'
import maplibregl, { type GeoJSONSource } from 'maplibre-gl'
import { cercle } from '../lib/geo'
import { useStore } from '../store'
import { margeBas } from './marge'

const SOURCE = 'precision'
const VIDE = { type: 'FeatureCollection', features: [] } as const

/** Couleur du thème (`--color-encours`), pour que le cercle suive le point bleu. */
const couleur = () => getComputedStyle(document.documentElement).getPropertyValue('--color-encours').trim() || '#4FA3E3'

/**
 * Point bleu de la position courante et cercle de précision autour. Au premier relevé, la carte s'y centre.
 * Le cercle est tracé en mètres réels (couche GeoJSON), donc juste à tous les niveaux de zoom.
 */
export function MaPosition({ map }: { map: maplibregl.Map }) {
  const position = useStore((s) => s.position)
  const pleinSoleil = useStore((s) => s.prefs.pleinSoleil)
  const marqueur = useRef<maplibregl.Marker | null>(null)
  // `style.load` doit retrouver la dernière position sans réabonner l'écouteur à chaque relevé.
  const courant = useRef({ position, pleinSoleil })
  courant.current = { position, pleinSoleil }

  const poser = useCallback(() => {
    const { position: p, pleinSoleil: soleil } = courant.current
    try {
      const donnees = p
        ? ({
            type: 'Feature',
            properties: {},
            geometry: { type: 'Polygon', coordinates: [cercle(p.lon, p.lat, p.precision)] },
          } as const)
        : VIDE
      const source = map.getSource(SOURCE) as GeoJSONSource | undefined
      if (source) source.setData(donnees)
      else {
        if (!p) return
        map.addSource(SOURCE, { type: 'geojson', data: donnees })
        map.addLayer({ id: 'precision-fond', type: 'fill', source: SOURCE, paint: {} })
        map.addLayer({ id: 'precision-trait', type: 'line', source: SOURCE, paint: {} })
      }
      // Plein soleil : aucune transparence, trait plus épais.
      map.setPaintProperty('precision-fond', 'fill-color', couleur())
      map.setPaintProperty('precision-fond', 'fill-opacity', soleil ? 0 : 0.16)
      map.setPaintProperty('precision-trait', 'line-color', couleur())
      map.setPaintProperty('precision-trait', 'line-width', soleil ? 3 : 1.5)
    } catch {
      // Style pas encore (re)chargé : l'événement `style.load` rappelle cette fonction.
    }
  }, [map])

  // Un changement de fond de carte remplace tout le style, et avec lui notre couche : on la repose.
  useEffect(() => {
    map.on('style.load', poser)
    return () => {
      map.off('style.load', poser)
      try {
        for (const id of ['precision-trait', 'precision-fond']) if (map.getLayer(id)) map.removeLayer(id)
        if (map.getSource(SOURCE)) map.removeSource(SOURCE)
      } catch {
        // la carte est en cours de destruction
      }
    }
  }, [map, poser])

  useEffect(() => {
    poser()
  }, [poser, position, pleinSoleil])

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
