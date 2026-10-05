import Dexie, { type EntityTable } from 'dexie'
import type { Suivi } from './types'
import { fusionner } from './lib/merge'

export type Pref = { cle: string; valeur: unknown }

export const db = new Dexie('fanisana') as Dexie & {
  suivi: EntityTable<Suivi, 'id'>
  prefs: EntityTable<Pref, 'cle'>
}

db.version(1).stores({
  suivi: 'id, statut, maj',
  prefs: 'cle',
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

export async function lirePref<T>(cle: string, defaut: T): Promise<T> {
  const p = await db.prefs.get(cle)
  return p ? (p.valeur as T) : defaut
}

export const ecrirePref = (cle: string, valeur: unknown) =>
  ecrire(() => db.prefs.put({ cle, valeur }))
