import type { Localisation, Tokatrano } from '../types'

/**
 * Ménages ajoutés sur le terrain (renfort dans un fokontany non dénombré par l'enquêteur) : ils arrivent d'un
 * fichier de liste, sans nom ni GPS la plupart du temps, et vivent en base à côté de `tokatrano.json`, qui
 * reste en lecture seule.
 *
 * Format accepté :
 * { fokontany, commune?, district?, region?, menages: [{ id, section?, lot?, grappe?, adresse_origine?|adresse?,
 *   note?, lat?, lon? }] }
 */

const texte = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const nombre = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** « Ambohimangakely » → « AMBOHIMANGAKELY » : clé de fokontany sans tiret bas, `nomFokontany` la rend lisible. */
const cleFokontany = (nom: string) =>
  nom.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '')

const numeroCourt = (lot: string) =>
  lot
    .replace(/^Lot\s+[IVX]+\s*B\s*/i, '')
    .replace(/^(\d+)\s+([A-Za-z])[A-Za-z]*$/, (_, n: string, l: string) => `${n}${l.toLowerCase()}`)

export const estListeMenages = (data: unknown): boolean =>
  !!data && typeof data === 'object' && !Array.isArray(data) && Array.isArray((data as { menages?: unknown }).menages)

export function lireListeMenages(data: unknown): { menages: Tokatrano[]; ignorees: number } {
  if (!estListeMenages(data)) throw new Error('Format inconnu')
  const doc = data as Record<string, unknown> & { menages: unknown[] }
  const nomFkt = texte(doc.fokontany)
  if (!nomFkt) throw new Error('Fokontany manquant')
  const fokontany = cleFokontany(nomFkt)

  type Ligne = { id: string; o: Record<string, unknown> }
  const lignes: Ligne[] = []
  const vus = new Set<string>()
  for (const e of doc.menages) {
    if (!e || typeof e !== 'object') continue
    const o = e as Record<string, unknown>
    const brut = texte(o.id)
    if (!brut) continue
    const id = `${fokontany}/${brut}`
    if (vus.has(id)) continue // doublon dans le fichier : une seule fiche
    vus.add(id)
    lignes.push({ id, o })
  }

  // Les numéros voisins d'une même grappe se trouvent ensemble : on les rappelle dans le repère de chaque fiche.
  const parGrappe = new Map<string, string[]>()
  for (const { o } of lignes) {
    const g = texte(o.grappe)
    if (g && g !== 'repere') parGrappe.set(g, [...(parGrappe.get(g) ?? []), texte(o.lot)])
  }

  const menages = lignes.map(({ id, o }): Tokatrano => {
    const section = texte(o.section)
    // Un commerce ou un lieu cité dans la liste : on le cherche pour se repérer, ce n'est pas un ménage numéroté.
    const estRepere = !section || section === '-'
    const lot = texte(o.lot)
    const grappe = texte(o.grappe)
    const voisins = (parGrappe.get(grappe) ?? []).filter((l) => l && l !== lot)
    const marika = [
      texte(o.note),
      voisins.length ? `Mêmes parages que : ${voisins.join(', ')}` : '',
    ].filter(Boolean).join(' · ')
    return {
      id,
      grappe: fokontany,
      segment: estRepere ? 'Repères' : section,
      fokontany,
      faritra: texte(doc.region),
      distrika: texte(doc.district),
      kaominina: texte(doc.commune),
      // Le numéro tient dans la pastille de l'épingle et de la liste : « 35b » pour « Lot II B 35 Bis »,
      // « 6p » pour « 6 PRE ». Le libellé complet reste dans `surnom`, affiché en titre.
      no: estRepere ? 'R' : numeroCourt(lot) || texte(o.id),
      logement: '',
      nbMenagesLogement: '',
      noDansLogement: '',
      chef: '',
      surnom: lot,
      pa: '',
      membres: '',
      adresse: texte(o.adresse_origine) || texte(o.adresse),
      marika,
      tratra: '',
      lat: nombre(o.lat),
      lon: nombre(o.lon),
      precision: nombre(o.precision_m),
      altitude: null,
      remarques: 'Ajouté par import de liste (renfort)',
    }
  })
  return { menages, ignorees: doc.menages.length - menages.length }
}

/** Position relevée par l'enquêteur : elle prime sur celle du dénombrement (absente ou fausse). */
export function appliquerLocalisations(menages: Tokatrano[], locs: Record<string, Localisation>): Tokatrano[] {
  if (!Object.keys(locs).length) return menages
  return menages.map((m) => {
    const l = locs[m.id]
    return l ? { ...m, lat: l.lat, lon: l.lon, precision: l.precision } : m
  })
}

/** Lit les localisations d'une sauvegarde ; les entrées incomplètes sont écartées. */
export function lireLocalisations(data: unknown): Localisation[] {
  const brutes = data && typeof data === 'object' ? (data as { localisations?: unknown }).localisations : undefined
  if (!Array.isArray(brutes)) return []
  return brutes.flatMap((e): Localisation[] => {
    if (!e || typeof e !== 'object') return []
    const o = e as Record<string, unknown>
    const lat = nombre(o.lat)
    const lon = nombre(o.lon)
    if (!texte(o.id) || lat == null || lon == null || Math.abs(lat) > 90 || Math.abs(lon) > 180) return []
    return [{ id: texte(o.id), lat, lon, precision: nombre(o.precision), maj: texte(o.maj) }]
  })
}

/** Ménages ajoutés présents dans une sauvegarde (même forme que `Tokatrano`). */
export function lireAjoutsSauvegarde(data: unknown): Tokatrano[] {
  const brutes = data && typeof data === 'object' ? (data as { ajouts?: unknown }).ajouts : undefined
  if (!Array.isArray(brutes)) return []
  return brutes.filter(
    (e): e is Tokatrano =>
      !!e && typeof e === 'object' && typeof (e as Tokatrano).id === 'string' && typeof (e as Tokatrano).fokontany === 'string',
  )
}
