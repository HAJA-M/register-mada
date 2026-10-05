import { STATUTS, estOuvert, type Statut, type Suivi, type Tokatrano } from '../types'
import { aUnGps, distanceVers, type Geolocalise, type Position } from './geo'

export type SuiviParId = Record<string, Suivi>
export type Filtre = 'tous' | 'reste' | Statut

export const statutDe = (suivi: SuiviParId, id: string): Statut => suivi[id]?.statut ?? 'todo'

export const cleSegment = (m: Tokatrano) => `${m.grappe}|${m.segment}`

/** `segment` vide = tous les segments. */
export const dansSegment = (menages: Tokatrano[], segment: string) =>
  segment ? menages.filter((m) => cleSegment(m) === segment) : menages

/** « ANTANAMBAO_11061608 » → « Antanambao » (le code après le tiret bas n'est pas lisible sur le terrain). */
export const nomFokontany = (f: string) => {
  const n = f.split('_')[0]!.toLowerCase()
  return n.charAt(0).toUpperCase() + n.slice(1)
}

export type Portee = { fokontany: string; segment: string }

/** Les ménages du périmètre choisi : un fokontany et/ou un segment (chaîne vide = pas de restriction). */
export const dansPortee = (menages: Tokatrano[], { fokontany, segment }: Portee) => {
  const f = fokontany ? menages.filter((m) => m.fokontany === fokontany) : menages
  return dansSegment(f, segment)
}

/** Fokontany présents dans les données, dans l'ordre d'apparition. */
export function fokontanys(menages: Tokatrano[]) {
  const vus = new Map<string, { cle: string; label: string; nb: number }>()
  for (const m of menages) {
    const v = vus.get(m.fokontany)
    if (v) v.nb++
    else vus.set(m.fokontany, { cle: m.fokontany, label: nomFokontany(m.fokontany), nb: 1 })
  }
  return [...vus.values()]
}

/** Minuscules sans accents, pour que « Rakoto » trouve « rakotô ». */
export const normaliser = (s: string) =>
  s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

export function filtrer(
  menages: Tokatrano[],
  suivi: SuiviParId,
  { recherche, filtre }: { recherche: string; filtre: Filtre },
): Tokatrano[] {
  const q = normaliser(recherche.trim())
  return menages.filter((m) => {
    const st = statutDe(suivi, m.id)
    if (filtre === 'reste' ? !estOuvert(st) : filtre !== 'tous' && st !== filtre) return false
    if (!q) return true
    return normaliser(`${m.chef} ${m.surnom} ${m.adresse} ${m.marika} ${m.id}`).includes(q)
  })
}

/** Les fiches sans GPS ou sans position courante passent en dernier, ordre d'origine conservé. */
export function trierParDistance(menages: Tokatrano[], me: Position | null): Tokatrano[] {
  if (!me) return menages
  return menages
    .map((m, i) => ({ m, i, d: distanceVers(me, m) }))
    .sort((a, b) => (a.d ?? Infinity) - (b.d ?? Infinity) || a.i - b.i)
    .map((x) => x.m)
}

/**
 * Ménage ouvert (à faire / en cours) géolocalisé le plus proche ; le premier de la liste sans position.
 * `sauf` écarte le ménage en cours de visite pour enchaîner sur le suivant.
 */
export function plusProcheOuvert(
  menages: Tokatrano[],
  suivi: SuiviParId,
  me: Position | null,
  sauf?: string,
): Geolocalise | null {
  const ouverts = menages.filter(
    (m): m is Geolocalise => m.id !== sauf && aUnGps(m) && estOuvert(statutDe(suivi, m.id)),
  )
  if (!ouverts.length) return null
  if (!me) return ouverts[0]!
  return ouverts.reduce((best, m) =>
    distanceVers(me, m)! < distanceVers(me, best)! ? m : best,
  )
}

export function compter(menages: Tokatrano[], suivi: SuiviParId) {
  const n = Object.fromEntries(STATUTS.map((s) => [s, 0])) as Record<Statut, number>
  for (const m of menages) n[statutDe(suivi, m.id)]++
  return { parStatut: n, reste: n.todo + n.encours }
}

export function segments(menages: Tokatrano[]) {
  const vus = new Map<string, { cle: string; label: string; fokontany: string }>()
  for (const m of menages) {
    const cle = cleSegment(m)
    if (!vus.has(cle)) vus.set(cle, { cle, label: `${m.grappe.split('/').pop()}/${m.segment}`, fokontany: m.fokontany })
  }
  return [...vus.values()]
}

/** Premier segment qui a encore du travail ; « Tous » (chaîne vide) quand tout est traité. */
export function segmentParDefaut(menages: Tokatrano[], suivi: SuiviParId): string {
  const trouve = segments(menages).find((g) => compter(dansSegment(menages, g.cle), suivi).reste > 0)
  return trouve?.cle ?? ''
}
