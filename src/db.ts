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

/** Fusionne et écrit en une transaction ; renvoie les fiches effectivement écrites. */
export function importerSuivi(entrantes: Suivi[]): Promise<Suivi[]> {
  return ecrire(() =>
    db.transaction('rw', db.suivi, async () => {
      const aEcrire = fusionner(await db.suivi.toArray(), entrantes)
      await db.suivi.bulkPut(aEcrire)
      return aEcrire
    }),
  )
}

export const effacerSuivi = () => db.suivi.clear()

export async function lirePref<T>(cle: string, defaut: T): Promise<T> {
  const p = await db.prefs.get(cle)
  return p ? (p.valeur as T) : defaut
}

export const ecrirePref = (cle: string, valeur: unknown) =>
  ecrire(() => db.prefs.put({ cle, valeur }))
