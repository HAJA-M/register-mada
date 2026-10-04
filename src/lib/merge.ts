import { STATUTS, type Statut, type Suivi } from '../types'

const estStatut = (v: unknown): v is Statut => STATUTS.includes(v as Statut)
const texte = (v: unknown) => (typeof v === 'string' ? v : '')

/**
 * Lit un fichier d'import. Accepte l'enveloppe `{ suivi: ... }` (export du prototype
 * ou de cette app) ou l'objet/tableau nu ; `suivi` peut être un dictionnaire indexé
 * par id (prototype) ou un tableau de fiches. Les entrées invalides sont ignorées.
 */
export function lireImport(data: unknown): Suivi[] {
  const brut =
    data && typeof data === 'object' && !Array.isArray(data) && 'suivi' in data
      ? (data as { suivi: unknown }).suivi
      : data
  if (!brut || typeof brut !== 'object') throw new Error('Format inconnu')

  const paires: [string | undefined, unknown][] = Array.isArray(brut)
    ? brut.map((e) => [undefined, e])
    : Object.entries(brut)

  const out: Suivi[] = []
  for (const [cle, e] of paires) {
    if (!e || typeof e !== 'object') continue
    const o = e as Record<string, unknown>
    const id = typeof o.id === 'string' && o.id ? o.id : cle
    if (!id || !estStatut(o.statut)) continue
    out.push({ id, statut: o.statut, date: texte(o.date), note: texte(o.note), maj: texte(o.maj) })
  }
  return out
}

/**
 * Fusion à l'import : l'entrée entrante gagne si la locale n'existe pas, si la locale
 * n'a pas de `maj`, ou si sa `maj` est strictement plus récente. En cas d'égalité, ou
 * si l'entrante n'a pas de `maj` alors qu'une locale existe, on garde le local.
 * Renvoie uniquement les fiches à écrire ; n'altère aucun argument.
 */
export function fusionner(locales: Iterable<Suivi>, entrantes: Suivi[]): Suivi[] {
  const parId = new Map<string, Suivi>()
  for (const s of locales) parId.set(s.id, s)

  const aEcrire = new Map<string, Suivi>()
  for (const e of entrantes) {
    const cur = aEcrire.get(e.id) ?? parId.get(e.id)
    if (!cur || !cur.maj || (e.maj && e.maj > cur.maj)) aEcrire.set(e.id, e)
  }
  return [...aEcrire.values()]
}
