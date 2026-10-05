import { create } from 'zustand'
import donnees from './data/tokatrano.json'
import {
  ecrirePref, ecrireSuivi, effacerSuivi, importerSuivi, lirePref, lireSuivi, supprimerSuivi,
} from './db'
import { segmentParDefaut } from './lib/liste'
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
  selection: string | null
  cadrage: number // incrémenté pour demander à la carte de recadrer tous les ménages
  alerte: string | null
  pret: boolean

  selectionner: (id: string | null) => void
  recadrer: () => void
  alerter: (message: string) => void
  fermerAlerte: () => void
  oublierAnnulation: () => void
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
  selection: null,
  cadrage: 0,
  alerte: null,
  pret: false,

  selectionner: (selection) => set({ selection }),
  recadrer: () => set((s) => ({ cadrage: s.cadrage + 1 })),
  alerter: (alerte) => set({ alerte }),
  fermerAlerte: () => set({ alerte: null }),
  oublierAnnulation: () => set({ derniere: null }),

  async hydrater() {
    const [liste, stockees] = await Promise.all([lireSuivi(), lirePref<Partial<Prefs> | null>('prefs', null)])
    const suivi = Object.fromEntries(liste.map((s) => [s.id, s]))
    const prefs: Prefs = { ...PREFS_DEFAUT, ...stockees }
    // Premier lancement : on ouvre le segment qui a encore du travail plutôt que les 77 d'un coup.
    if (!stockees) prefs.segment = segmentParDefaut(get().menages, suivi)
    set({ suivi, prefs, pret: true })
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

  // N'annule que le statut et la date : une note tapée entre-temps est conservée.
  async annuler() {
    const d = get().derniere
    if (!d) return
    const cur = get().suivi[d.id] ?? vide(d.id)
    const restaure: Suivi = {
      ...cur,
      statut: d.avant?.statut ?? 'todo',
      date: d.avant?.date ?? '',
      maj: new Date().toISOString(),
    }
    const vaAuNeant = !d.avant && !restaure.note
    if (vaAuNeant) await supprimerSuivi(d.id)
    else await ecrireSuivi(restaure)
    set((s) => {
      const suivi = { ...s.suivi }
      if (vaAuNeant) delete suivi[d.id]
      else suivi[d.id] = restaure
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
