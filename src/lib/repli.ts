/**
 * Esri ne répond pas 404 quand il n'a pas d'imagerie à un niveau de zoom : il renvoie une image
 * « Map data not yet available » de 2 521 octets, toujours la même. Ce module la reconnaît et
 * calcule quelle portion de la tuile du niveau inférieur la remplace.
 */

export const TAILLE_TUILE = 256
const TAILLE_ABSENTE = 2521
const EMPREINTE_ABSENTE = '9eafd300d61393184a4abc1d458564cfd1cd9b6f9c4e9c74687045c0a0e5b858'

const hex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

/** Vrai pour l'image de remplacement d'Esri. Le test de taille évite de hacher les vraies tuiles (~18 Ko). */
export async function estImageAbsente(buf: ArrayBuffer): Promise<boolean> {
  if (buf.byteLength !== TAILLE_ABSENTE) return false
  return hex(await crypto.subtle.digest('SHA-256', buf)) === EMPREINTE_ABSENTE
}

export type Decoupe = {
  z: number
  x: number
  y: number
  /** Coin haut-gauche et côté, en pixels de la tuile parente (256 × 256). */
  sx: number
  sy: number
  cote: number
}

/** La tuile (z, x, y) est incluse dans la tuile parente `niveaux` zooms plus haut ; où, dedans ? */
export function parent(z: number, x: number, y: number, niveaux: number): Decoupe {
  const n = 2 ** niveaux
  const cote = TAILLE_TUILE / n
  return {
    z: z - niveaux,
    x: Math.floor(x / n),
    y: Math.floor(y / n),
    sx: (x % n) * cote,
    sy: (y % n) * cote,
    cote,
  }
}

/** Extrait z, x, y d'une adresse `esri://{z}/{y}/{x}` (même ordre que le service Esri). */
export function lireAdresse(url: string): { z: number; y: number; x: number } | null {
  const m = /^esri:\/\/(\d+)\/(\d+)\/(\d+)$/.exec(url)
  return m ? { z: Number(m[1]), y: Number(m[2]), x: Number(m[3]) } : null
}
