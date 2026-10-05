import type { Emprise } from './geo'

/** Nom du cache des tuiles : partagé entre la page (téléchargement) et le service worker (lecture). */
export const CACHE_TUILES = 'fanisana-tiles-v1'

export const Z_MIN = 14
export const Z_MAX = 18

export type Fond = 'sat' | 'osm'

export const MODELE_TUILES: Record<Fond, string> = {
  sat: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  osm: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
}

/** Poids moyen d'une tuile, mesuré sur le prototype (770 images satellite ≈ 16 Mo). */
export const OCTETS_PAR_TUILE: Record<Fond, number> = { sat: 21_000, osm: 12_000 }

export const estTuile = (url: URL) =>
  url.hostname === 'server.arcgisonline.com' || url.hostname === 'tile.openstreetmap.org'

export const lonVersX = (lon: number, z: number) => Math.floor(((lon + 180) / 360) * 2 ** z)

export const latVersY = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z)
}

/** URLs des tuiles qui couvrent l'emprise, de `zMin` à `zMax` inclus. */
export function listeTuiles(e: Emprise, fond: Fond, zMin = Z_MIN, zMax = Z_MAX): string[] {
  const urls: string[] = []
  for (let z = zMin; z <= zMax; z++) {
    // y croît vers le sud : le nord donne le plus petit y.
    for (let x = lonVersX(e.ouest, z); x <= lonVersX(e.est, z); x++) {
      for (let y = latVersY(e.nord, z); y <= latVersY(e.sud, z); y++) {
        urls.push(
          MODELE_TUILES[fond].replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y)),
        )
      }
    }
  }
  return urls
}

/** Réunit plusieurs listes sans doublon : deux segments voisins partagent des tuiles. */
export const unir = (...listes: string[][]): string[] => [...new Set(listes.flat())]

export const megaoctets = (octets: number) => {
  const mo = octets / 1_000_000
  return mo < 10 ? `${mo.toFixed(1).replace('.', ',')} Mo` : `${Math.round(mo)} Mo`
}
