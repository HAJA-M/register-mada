import maplibregl from 'maplibre-gl'
import { estImageAbsente, lireAdresse, parent, TAILLE_TUILE, type Decoupe } from '../lib/repli'
import { MODELE_TUILES } from '../lib/tuiles'

/** Adresse de tuile que MapLibre passe à notre chargeur (il ne sait pas lire autre chose que http). */
export const MODELE_ESRI = 'esri://{z}/{y}/{x}'

/** Nombre de zooms qu'on remonte au maximum pour retrouver de l'imagerie. */
const NIVEAUX_MAX = 4

const adresse = (z: number, y: number, x: number) =>
  MODELE_TUILES.sat.replace('{z}', String(z)).replace('{y}', String(y)).replace('{x}', String(x))

async function lire(z: number, y: number, x: number, signal: AbortSignal): Promise<ArrayBuffer> {
  const r = await fetch(adresse(z, y, x), { mode: 'cors', signal })
  if (!r.ok) throw new Error(`Tuile ${z}/${y}/${x} : HTTP ${r.status}`)
  return r.arrayBuffer()
}

/** Agrandit la portion de la tuile parente qui recouvre la tuile demandée. */
async function agrandir(buf: ArrayBuffer, d: Decoupe): Promise<ArrayBuffer> {
  const image = await createImageBitmap(new Blob([buf]))
  const toile = new OffscreenCanvas(TAILLE_TUILE, TAILLE_TUILE)
  const g = toile.getContext('2d')!
  g.imageSmoothingQuality = 'high'
  g.drawImage(image, d.sx, d.sy, d.cote, d.cote, 0, 0, TAILLE_TUILE, TAILLE_TUILE)
  image.close()
  return (await toile.convertToBlob({ type: 'image/jpeg', quality: 0.9 })).arrayBuffer()
}

/**
 * Tuile satellite, avec repli : là où Esri n'a pas d'imagerie (il renvoie une image « Map data not
 * yet available »), on affiche la tuile du niveau inférieur agrandie plutôt que ce message.
 * Les deux lectures passent par `fetch`, donc par le service worker et le cache hors ligne.
 */
export async function tuileSatellite(z: number, y: number, x: number, signal: AbortSignal): Promise<ArrayBuffer> {
  const brute = await lire(z, y, x, signal)
  if (!(await estImageAbsente(brute))) return brute
  for (let n = 1; n <= NIVEAUX_MAX && z - n >= 0; n++) {
    const d = parent(z, x, y, n)
    let haut: ArrayBuffer
    try {
      haut = await lire(d.z, d.y, d.x, signal)
    } catch {
      return brute // pas de réseau et rien en cache : tant pis, MapLibre affichera ce qu'on a
    }
    if (!(await estImageAbsente(haut))) return agrandir(haut, d)
  }
  return brute
}

let enregistre = false

/** À appeler une fois : apprend à MapLibre l'adresse `esri://`. */
export function enregistrerTuilesEsri() {
  if (enregistre) return
  enregistre = true
  maplibregl.addProtocol('esri', async (params, abort) => {
    const t = lireAdresse(params.url)
    if (!t) throw new Error(`Adresse de tuile inconnue : ${params.url}`)
    return { data: await tuileSatellite(t.z, t.y, t.x, abort.signal) }
  })
}
