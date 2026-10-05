import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { aUnGps, pointsFiables } from '../lib/geo'
import { dansPortee, statutDe } from '../lib/liste'
import { useStore } from '../store'
import { margeBas, margeFeuille } from './marge'
import type { Statut, Tokatrano } from '../types'

// MapLibre positionne l'élément racine avec `transform` : le style de l'épingle vit
// donc sur un enfant, jamais sur la racine.
const PIN = '<svg viewBox="0 0 30 38" aria-hidden="true"><path d="M15 36.5C15 36.5 1.5 23.5 1.5 14.5a13.5 13.5 0 0 1 27 0c0 9-13.5 22-13.5 22z"/></svg>'

function creerElement(m: Tokatrano, statut: Statut, choisi: boolean): HTMLElement {
  const racine = document.createElement('div')
  const el = document.createElement('div')
  el.dataset.statut = statut
  if (statut === 'fait' && !choisi) {
    el.className = 'repere-fait'
  } else {
    el.className = choisi ? 'repere sel' : 'repere'
    el.innerHTML = PIN
    const n = document.createElement('b')
    n.textContent = m.no
    el.append(n)
  }
  racine.setAttribute('role', 'img')
  racine.setAttribute('aria-label', `${m.no} ${m.chef || m.surnom || ''}`.trim())
  racine.style.cursor = 'pointer'
  racine.addEventListener('click', () => useStore.getState().selectionner(m.id))
  racine.append(el)
  return racine
}

/** Un repère par ménage géolocalisé ; les fiches sans GPS sont simplement absentes de la carte. */
export function Reperes({ map }: { map: maplibregl.Map }) {
  const menages = useStore((s) => s.menages)
  const suivi = useStore((s) => s.suivi)
  const segment = useStore((s) => s.prefs.segment)
  const fokontany = useStore((s) => s.prefs.fokontany)
  const selection = useStore((s) => s.selection)
  const cadrage = useStore((s) => s.cadrage)
  const marqueurs = useRef(new Map<string, { mk: maplibregl.Marker; cle: string }>())

  const visibles = dansPortee(menages, { fokontany, segment })

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
        anchor: petit ? 'center' : 'bottom',
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

  // Dézoomé, les épingles se réduisent (voir carte.css).
  useEffect(() => {
    const conteneur = map.getContainer()
    const maj = () => conteneur.classList.toggle('zoom-bas', map.getZoom() < 15.5)
    maj()
    // `moveend` : un cadrage sans animation (fitBounds) ne laisse pas toujours le bon zoom à l'événement `zoom`.
    map.on('zoom', maj)
    map.on('moveend', maj)
    return () => {
      map.off('zoom', maj)
      map.off('moveend', maj)
    }
  }, [map])

  // Cadrage : on exclut les relevés aberrants (voir pointsFiables).
  useEffect(() => {
    const pts = pointsFiables(visibles)
    if (!pts.length) return
    const b = new maplibregl.LngLatBounds()
    pts.forEach((p) => b.extend([p.lon, p.lat]))
    map.fitBounds(b, { padding: { top: 48, left: 48, right: 48, bottom: margeFeuille() }, animate: false, maxZoom: 18 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fokontany, segment, cadrage])

  // Un ménage choisi dans le ruban ou la liste : on s'y rend (sans bouger si la fiche n'a pas de GPS).
  useEffect(() => {
    const m = menages.find((x) => x.id === selection)
    if (!m || !aUnGps(m)) return
    map.easeTo({
      center: [m.lon, m.lat],
      zoom: Math.max(map.getZoom(), 17),
      padding: { top: 0, left: 0, right: 0, bottom: margeBas() },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, selection])

  return null
}
