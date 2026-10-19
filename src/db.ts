import Dexie, { type EntityTable } from 'dexie'
import type { Localisation, Suivi, Tokatrano } from './types'
import { fusionner } from './lib/merge'

export type Pref = { cle: string; valeur: unknown }

export const db = new Dexie('fanisana') as Dexie & {
  suivi: EntityTable<Suivi, 'id'>
  prefs: EntityTable<Pref, 'cle'>
  ajouts: EntityTable<Tokatrano, 'id'>
  localisations: EntityTable<Localisation, 'id'>
}

db.version(1).stores({
  suivi: 'id, statut, maj',
  prefs: 'cle',
})

// v2 : ménages ajoutés par import de liste (renfort) et positions relevées par l'enquêteur.
// Tables séparées du suivi, comme le dénombrement : chacune peut être remplacée sans toucher aux autres.
db.version(2).stores({
  ajouts: 'id, fokontany',
  localisations: 'id, maj',
})

export class QuotaError extends Error {
  constructor() {
    super('Stockage plein')
    this.name = 'QuotaError'
  }
}

const estQuota = (e: unknown) =>
  (e as Error | undefined)?.name === 'QuotaExceededError' ||
  (e as { inner?: Error } | undefined)?.inner?.name === 'QuotaExceededError'

/** Convertit l'erreur de quota IndexedDB en QuotaError pour que l'UI puisse prévenir. */
async function ecrire<T>(op: () => Promise<T>): Promise<T> {
  try {
    return await op()
  } catch (e) {
    throw estQuota(e) ? new QuotaError() : e
  }
}

export const lireSuivi = () => db.suivi.toArray()

export const ecrireSuivi = (s: Suivi) => ecrire(() => db.suivi.put(s))

export const supprimerSuivi = (id: string) => db.suivi.delete(id)

/**
 * Fusionne et écrit en une transaction. Renvoie les fiches effectivement écrites et l'état d'avant de chacune
 * (`null` : elle n'existait pas), de quoi défaire l'import.
 */
export function importerSuivi(entrantes: Suivi[]): Promise<{ ecrites: Suivi[]; avant: Map<string, Suivi | null> }> {
  return ecrire(() =>
    db.transaction('rw', db.suivi, async () => {
      const locales = await db.suivi.toArray()
      const ecrites = fusionner(locales, entrantes)
      const parId = new Map(locales.map((s) => [s.id, s]))
      const avant = new Map(ecrites.map((e) => [e.id, parId.get(e.id) ?? null]))
      await db.suivi.bulkPut(ecrites)
      return { ecrites, avant }
    }),
  )
}

/** Écrit et supprime d'un seul bloc : une annulation ne doit jamais s'appliquer à moitié. */
export const appliquerPlan = (aEcrire: Suivi[], aSupprimer: string[]) =>
  ecrire(() =>
    db.transaction('rw', db.suivi, async () => {
      await db.suivi.bulkPut(aEcrire)
      await db.suivi.bulkDelete(aSupprimer)
    }),
  )

export const effacerSuivi = () => db.suivi.clear()

export const lireAjouts = () => db.ajouts.toArray()

/** Remplace les fiches de même id : réimporter une liste corrigée met à jour sans dupliquer. */
export const ecrireAjouts = (menages: Tokatrano[]) => ecrire(() => db.ajouts.bulkPut(menages))

export const lireLocalisationsDb = () => db.localisations.toArray()

export const ecrireLocalisation = (l: Localisation) => ecrire(() => db.localisations.put(l))

export const supprimerLocalisation = (id: string) => db.localisations.delete(id)

/** Fusion sur `maj`, comme le suivi : une position plus récente ici n'est jamais écrasée par une sauvegarde. */
export function importerLocalisations(entrantes: Localisation[]): Promise<Localisation[]> {
  return ecrire(() =>
    db.transaction('rw', db.localisations, async () => {
      const locales = new Map((await db.localisations.toArray()).map((l) => [l.id, l]))
      const t = (s: string) => (s ? Date.parse(s) : NaN)
      const aEcrire = entrantes.filter((e) => {
        const cur = locales.get(e.id)
        return !cur || Number.isNaN(t(cur.maj)) || t(e.maj) > t(cur.maj)
      })
      await db.localisations.bulkPut(aEcrire)
      return aEcrire
    }),
  )
}

export async function lirePref<T>(cle: string, defaut: T): Promise<T> {
  const p = await db.prefs.get(cle)
  return p ? (p.valeur as T) : defaut
}

export const ecrirePref = (cle: string, valeur: unknown) =>
  ecrire(() => db.prefs.put({ cle, valeur }))
