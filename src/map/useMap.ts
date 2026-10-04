import { useEffect, useRef, useState, type RefObject } from 'react'
import maplibregl, { type StyleSpecification } from 'maplibre-gl'

export const SAT_TUILES =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
export const OSM_TUILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

export const styleRaster = (fond: 'sat' | 'osm'): StyleSpecification => ({
  version: 8,
  sources: {
    fond: {
      type: 'raster',
      tiles: [fond === 'sat' ? SAT_TUILES : OSM_TUILES],
      tileSize: 256,
      maxzoom: 19,
      attribution: fond === 'sat' ? 'Esri, Maxar, Earthstar Geographics' : 'OpenStreetMap',
    },
  },
  layers: [{ id: 'fond', type: 'raster', source: 'fond' }],
})

/** Crée la carte dans le conteneur ; renvoie null avant le premier montage. */
export function useMap(
  conteneur: RefObject<HTMLDivElement | null>,
  fond: 'sat' | 'osm',
): maplibregl.Map | null {
  const [map, setMap] = useState<maplibregl.Map | null>(null)
  const fondInitial = useRef(fond)

  useEffect(() => {
    if (!conteneur.current) return
    const m = new maplibregl.Map({
      container: conteneur.current,
      style: styleRaster(fondInitial.current),
      center: [47.5985, -18.7905],
      zoom: 14,
      maxZoom: 19,
      attributionControl: false,
    })
    // En haut : le bas de l'écran est occupé par la feuille.
    m.addControl(new maplibregl.AttributionControl({ compact: true }), 'top-left')
    m.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'top-left')
    setMap(m)
    return () => {
      setMap(null)
      m.remove()
    }
  }, [conteneur])

  useEffect(() => {
    if (map && fond !== fondInitial.current) {
      fondInitial.current = fond
      map.setStyle(styleRaster(fond))
    }
  }, [map, fond])

  return map
}
