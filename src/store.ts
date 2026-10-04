import { create } from 'zustand'
import donnees from './data/tokatrano.json'
import {
  ecrirePref, ecrireSuivi, effacerSuivi, importerSuivi, lirePref, lireSuivi, supprimerSuivi,
} from './db'
import { lireImport } from './lib/merge'
import type { Position } from './lib/geo'
import type { Statut, Suivi, Tokatrano } from './types'

export type Prefs = {
  segment: string // "grappe|segment" ou ''
  fond: 'sat' | 'osm'
  tri: 'num' | 'dist'
  pleinSoleil: boolean
  masquerFaits: boolean
}

const PREFS_DEFAUT: Prefs = {
  segment: '', fond: 'sat', tri: 'num', pleinSoleil: false, masquerFaits: false,
}

const aujourdhui = () => new Date().toISOString().slice(0, 10)

type Annulation = { id: string; avant: Suivi | null }

type State = {
  menages: Tokatrano[] // lecture seule, jamais écrit en base
  suivi: Record<string, Suivi>
  prefs: Prefs
  position: (Position & { precision: number }) | null
  derniere: Annulation | null
  pret: boolean

  hydrater: () => Promise<void>
  suiviDe: (id: string) => Suivi
  changerStatut: (id: string, statut: Statut) => Promise<void>
  modifier: (id: string, patch: Partial<Pick<Suivi, 'date' | 'note'>>) => Promise<void>
  annuler: () => Promise<void>
  importer: (json: unknown) => Promise<number>
  toutEffacer: () => Promise<void>
  definirPref: <K extends keyof Prefs>(cle: K, valeur: Prefs[K]) => Promise<void>
  definirPosition: (p: State['position']) => void
}

const vide = (id: string): Suivi => ({ id, statut: 'todo', date: '', note: '', maj: '' })

export const useStore = create<State>((set, get) => ({
  menages: donnees as Tokatrano[],
  suivi: {},
  prefs: PREFS_DEFAUT,
  position: null,
  derniere: null,
  pret: false,

  async hydrater() {
    const [liste, prefs] = await Promise.all([lireSuivi(), lirePref('prefs', PREFS_DEFAUT)])
    set({
      suivi: Object.fromEntries(liste.map((s) => [s.id, s])),
      prefs: { ...PREFS_DEFAUT, ...prefs },
      pret: true,
    })
  },

  suiviDe: (id) => get().suivi[id] ?? vide(id),

  // Dexie d'abord, état ensuite : si l'écriture échoue, rien ne change à l'écran.
  async changerStatut(id, statut) {
    const avant = get().suivi[id] ?? null
    const cur = avant ?? vide(id)
    const suivant: Suivi = {
      ...cur,
      statut,
      date: statut === 'todo' ? cur.date : cur.date || aujourdhui(),
      maj: new Date().toISOString(),
    }
    await ecrireSuivi(suivant)
    set((s) => ({ suivi: { ...s.suivi, [id]: suivant }, derniere: { id, avant } }))
  },

  async modifier(id, patch) {
    const suivant: Suivi = { ...get().suiviDe(id), ...patch, maj: new Date().toISOString() }
    await ecrireSuivi(suivant)
    set((s) => ({ suivi: { ...s.suivi, [id]: suivant } }))
  },

  async annuler() {
    const d = get().derniere
    if (!d) return
    if (d.avant) await ecrireSuivi(d.avant)
    else await supprimerSuivi(d.id)
    set((s) => {
      const suivi = { ...s.suivi }
      if (d.avant) suivi[d.id] = d.avant
      else delete suivi[d.id]
      return { suivi, derniere: null }
    })
  },

  async importer(json) {
    const ecrites = await importerSuivi(lireImport(json))
    set((s) => ({
      suivi: { ...s.suivi, ...Object.fromEntries(ecrites.map((e) => [e.id, e])) },
      derniere: null,
    }))
    return ecrites.length
  },

  async toutEffacer() {
    await effacerSuivi()
    set({ suivi: {}, derniere: null })
  },

  async definirPref(cle, valeur) {
    const prefs = { ...get().prefs, [cle]: valeur }
    await ecrirePref('prefs', prefs)
    set({ prefs })
  },

  definirPosition: (position) => set({ position }),
}))
