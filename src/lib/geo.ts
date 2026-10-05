import type { Tokatrano } from '../types'

const R = 6371000
const RAD = Math.PI / 180

/** Distance orthodromique en mètres (haversine). */
export function distance(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dLat = (bLat - aLat) * RAD
  const dLon = (bLon - aLon) * RAD
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * RAD) * Math.cos(bLat * RAD) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

/** « 120 m » arrondi à 5 m sous 950 m, « 1,3 km » au-delà. */
export function formatDistance(d: number | null | undefined): string {
  if (d == null) return ''
  if (d < 950) return `${Math.round(d / 5) * 5} m`
  return `${(Math.round(d / 100) / 10).toFixed(1).replace('.', ',')} km`
}

export type Position = { lat: number; lon: number }
export type Geolocalise = Tokatrano & { lat: number; lon: number }

export const aUnGps = (m: Tokatrano): m is Geolocalise => m.lat != null && m.lon != null

/** Distance depuis la position courante, ou null si l'un des deux points manque. */
export function distanceVers(me: Position | null, m: Tokatrano): number | null {
  if (!me || !aUnGps(m)) return null
  return distance(me.lat, me.lon, m.lat, m.lon)
}

const mediane = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2
}

/**
 * Points utilisables pour le cadrage et l'emprise à télécharger : on écarte les
 * fiches sans GPS et celles à plus de `rayonMax` mètres de la médiane (les deux
 * relevés de la grappe 08 S01 tombent à ~6 km). Les écartées restent dans la liste.
 */
export function pointsFiables(menages: Tokatrano[], rayonMax = 3000): Geolocalise[] {
  const pts = menages.filter(aUnGps)
  if (pts.length === 0) return []
  const cLat = mediane(pts.map((p) => p.lat))
  const cLon = mediane(pts.map((p) => p.lon))
  return pts.filter((p) => distance(cLat, cLon, p.lat, p.lon) <= rayonMax)
}

export type Emprise = { sud: number; nord: number; ouest: number; est: number }

export function emprise(menages: Tokatrano[], marge = 0): Emprise | null {
  const pts = pointsFiables(menages)
  if (pts.length === 0) return null
  const lats = pts.map((p) => p.lat)
  const lons = pts.map((p) => p.lon)
  return {
    sud: Math.min(...lats) - marge,
    nord: Math.max(...lats) + marge,
    ouest: Math.min(...lons) - marge,
    est: Math.max(...lons) + marge,
  }
}

/**
 * Anneau de `pas` points à `rayon` mètres du centre (formule de la destination sur la sphère), refermé sur lui-même.
 * Sert à dessiner le cercle de précision du GPS : un rayon en mètres reste juste à tous les niveaux de zoom.
 */
export function cercle(lon: number, lat: number, rayon: number, pas = 64): [number, number][] {
  const d = rayon / R
  const phi = lat * RAD
  const lambda = lon * RAD
  const anneau: [number, number][] = []
  for (let i = 0; i < pas; i++) {
    const cap = (2 * Math.PI * i) / pas
    const phi2 = Math.asin(Math.sin(phi) * Math.cos(d) + Math.cos(phi) * Math.sin(d) * Math.cos(cap))
    const lambda2 =
      lambda + Math.atan2(Math.sin(cap) * Math.sin(d) * Math.cos(phi), Math.cos(d) - Math.sin(phi) * Math.sin(phi2))
    anneau.push([lambda2 / RAD, phi2 / RAD])
  }
  anneau.push(anneau[0]!)
  return anneau
}

export type QualiteGps = 'bonne' | 'moyenne' | 'faible'

/** Seuils pratiques : 15 m suffit pour reconnaître une maison, au-delà de 50 m on cherche à l'aveugle. */
export const qualiteGps = (precisionM: number): QualiteGps =>
  precisionM <= 15 ? 'bonne' : precisionM <= 50 ? 'moyenne' : 'faible'
