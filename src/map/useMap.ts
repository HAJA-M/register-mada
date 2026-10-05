import { useEffect, useRef, useState, type RefObject } from 'react'
import maplibregl, { type StyleSpecification } from 'maplibre-gl'
import { MODELE_TUILES } from '../lib/tuiles'
import { MODELE_ESRI, enregistrerTuilesEsri } from './tuilesEsri'


export const styleRaster = (fond: 'sat' | 'osm'): StyleSpecification => ({
  version: 8,
  sources: {
    fond: {
      type: 'raster',
      tiles: [fond === 'sat' ? MODELE_ESRI : MODELE_TUILES.osm],
      tileSize: 256,
      maxzoom: 18, // au-delà, MapLibre agrandit la tuile z18 : ce que le hors ligne a téléchargé suffit
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
    enregistrerTuilesEsri()
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
