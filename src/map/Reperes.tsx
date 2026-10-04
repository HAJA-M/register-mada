import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { aUnGps, pointsFiables } from '../lib/geo'
import { dansSegment, statutDe } from '../lib/liste'
import { useStore } from '../store'
import type { Statut, Tokatrano } from '../types'

// Place laissée au bas de l'écran par la feuille repliée, pour que le ménage choisi reste visible.
const MARGE_BAS = 230

// MapLibre positionne l'élément racine avec `transform` : la rotation de l'épingle
// vit donc sur un enfant, jamais sur la racine.
function creerElement(m: Tokatrano, statut: Statut, choisi: boolean): HTMLElement {
  const racine = document.createElement('div')
  const el = document.createElement('div')
  el.dataset.statut = statut
  if (statut === 'fait' && !choisi) {
    el.className = 'repere-fait'
  } else {
    el.className = choisi ? 'repere sel' : 'repere'
    const n = document.createElement('b')
    n.textContent = m.no
    el.append(n)
  }
  racine.setAttribute('role', 'img')
  racine.setAttribute('aria-label', `${m.no} ${m.chef || m.surnom || ''}`.trim())
  racine.append(el)
  return racine
}

/** Un repère par ménage géolocalisé ; les fiches sans GPS sont simplement absentes de la carte. */
export function Reperes({ map }: { map: maplibregl.Map }) {
  const menages = useStore((s) => s.menages)
  const suivi = useStore((s) => s.suivi)
  const segment = useStore((s) => s.prefs.segment)
  const selection = useStore((s) => s.selection)
  const marqueurs = useRef(new Map<string, { mk: maplibregl.Marker; cle: string }>())

  const visibles = dansSegment(menages, segment)

  useEffect(() => {
    const actuels = marqueurs.current
    const voulus = new Set<string>()
    for (const m of visibles) {
      if (!aUnGps(m)) continue
      voulus.add(m.id)
      const statut = statutDe(suivi, m.id)
      const choisi = m.id === selection
      const cle = `${statut}${choisi ? '*' : ''}`
      const existant = actuels.get(m.id)
      if (existant?.cle === cle) continue
      existant?.mk.remove()
      const petit = statut === 'fait' && !choisi
      const mk = new maplibregl.Marker({
        element: creerElement(m, statut, choisi),
        anchor: 'center',
        // la pointe de l'épingle tournée est à ~21 px sous le centre du carré de 30 px
        offset: petit ? [0, 0] : [0, -21],
      })
        .setLngLat([m.lon, m.lat])
        .addTo(map)
      actuels.set(m.id, { mk, cle })
    }
    for (const [id, { mk }] of actuels) {
      if (!voulus.has(id)) {
        mk.remove()
        actuels.delete(id)
      }
    }
  })

  useEffect(() => {
    const actuels = marqueurs.current
    return () => {
      actuels.forEach(({ mk }) => mk.remove())
      actuels.clear()
    }
  }, [map])

  // Cadrage : on exclut les relevés aberrants (voir pointsFiables).
  useEffect(() => {
    const pts = pointsFiables(visibles)
    if (!pts.length) return
    const b = new maplibregl.LngLatBounds()
    pts.forEach((p) => b.extend([p.lon, p.lat]))
    map.fitBounds(b, { padding: { top: 48, left: 48, right: 48, bottom: MARGE_BAS }, animate: false, maxZoom: 18 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, segment])

  // Un ménage choisi dans le ruban ou la liste : on s'y rend (sans bouger si la fiche n'a pas de GPS).
  useEffect(() => {
    const m = menages.find((x) => x.id === selection)
    if (!m || !aUnGps(m)) return
    map.easeTo({
      center: [m.lon, m.lat],
      zoom: Math.max(map.getZoom(), 17),
      padding: { top: 0, left: 0, right: 0, bottom: MARGE_BAS },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, selection])

  return null
}
