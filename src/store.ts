import { create } from 'zustand'
import donnees from './data/tokatrano.json'
import {
  appliquerPlan, ecrirePref, ecrireSuivi, effacerSuivi, importerSuivi, lirePref, lireSuivi, supprimerSuivi,
} from './db'
import { cleSegment, fokontanys, segmentParDefaut } from './lib/liste'
import { lireImportDetail } from './lib/merge'
import { planAnnulation, type Instantane } from './lib/restauration'
import type { Position } from './lib/geo'
import type { Statut, Suivi, Tokatrano } from './types'

export type Prefs = {
  fokontany: string // clé de fokontany (ex. ANTANAMBAO_11061608) ou ''
  segment: string // "grappe|segment" ou ''
  fond: 'sat' | 'osm'
  tri: 'num' | 'dist'
  pleinSoleil: boolean
  masquerFaits: boolean
  sauvegarde: string // ISO de la dernière sauvegarde exportée, ou ''
}

const PREFS_DEFAUT: Prefs = {
  fokontany: '', segment: '', fond: 'sat', tri: 'num', pleinSoleil: false, masquerFaits: false, sauvegarde: '',
}

const aujourdhui = () => new Date().toISOString().slice(0, 10)

type Annulation = { id: string; avant: Suivi | null }

/** Ce qu'il faut pour défaire un import ou un effacement tant que l'application reste ouverte. */
type Restauration = { libelle: string; avant: Instantane; apres: Instantane }

export type RapportImport = {
  lues: number // fiches distinctes dans le fichier
  misesAJour: number
  inchangees: number // le local était aussi récent, ou plus
  ignorees: number // entrées illisibles
  inconnues: number // sans ménage correspondant dans les données actuelles (conservées)
}

type State = {
  menages: Tokatrano[] // lecture seule, jamais écrit en base
  suivi: Record<string, Suivi>
  prefs: Prefs
  position: (Position & { precision: number }) | null
  derniere: Annulation | null
  restauration: Restauration | null
  selection: string | null
  cadrage: number // incrémenté pour demander à la carte de recadrer tous les ménages
  panneau: 'horsligne' | 'reglages' | null
  alerte: string | null
  pret: boolean

  selectionner: (id: string | null) => void
  recadrer: () => void
  ouvrirPanneau: (p: 'horsligne' | 'reglages' | null) => void
  alerter: (message: string) => void
  fermerAlerte: () => void
  oublierAnnulation: () => void
  hydrater: () => Promise<void>
  suiviDe: (id: string) => Suivi
  changerStatut: (id: string, statut: Statut) => Promise<void>
  modifier: (id: string, patch: Partial<Pick<Suivi, 'date' | 'note'>>) => Promise<void>
  annuler: () => Promise<void>
  importerFichier: (json: unknown) => Promise<RapportImport>
  toutEffacer: () => Promise<void>
  annulerRestauration: () => Promise<{ rendues: number; conservees: number }>
  marquerSauvegarde: () => Promise<void>
  definirPref: <K extends keyof Prefs>(cle: K, valeur: Prefs[K]) => Promise<void>
  definirPrefs: (patch: Partial<Prefs>) => Promise<void>
  definirPosition: (p: State['position']) => void
}

const vide = (id: string): Suivi => ({ id, statut: 'todo', date: '', note: '', maj: '' })

export const useStore = create<State>((set, get) => ({
  menages: donnees as Tokatrano[],
  suivi: {},
  prefs: PREFS_DEFAUT,
  position: null,
  derniere: null,
  restauration: null,
  selection: null,
  cadrage: 0,
  panneau: null,
  alerte: null,
  pret: false,

  selectionner: (selection) => set({ selection }),
  recadrer: () => set((s) => ({ cadrage: s.cadrage + 1 })),
  ouvrirPanneau: (panneau) => set({ panneau }),
  alerter: (alerte) => set({ alerte }),
  fermerAlerte: () => set({ alerte: null }),
  oublierAnnulation: () => set({ derniere: null }),

  async hydrater() {
    const [liste, stockees] = await Promise.all([lireSuivi(), lirePref<Partial<Prefs> | null>('prefs', null)])
    const suivi = Object.fromEntries(liste.map((s) => [s.id, s]))
    const prefs: Prefs = { ...PREFS_DEFAUT, ...stockees }
    // Les données peuvent avoir changé depuis la dernière ouverture : un périmètre disparu ne doit pas laisser l'écran vide.
    const menages = get().menages
    if (prefs.fokontany && !fokontanys(menages).some((f) => f.cle === prefs.fokontany)) prefs.fokontany = ''
    if (prefs.segment && !menages.some((m) => cleSegment(m) === prefs.segment)) prefs.segment = ''
    // Premier lancement : on ouvre le segment qui a encore du travail plutôt que les 77 d'un coup.
    if (!stockees) prefs.segment = segmentParDefaut(menages, suivi)
    // Un segment implique son fokontany (les préférences d'une ancienne version n'en avaient pas).
    if (prefs.segment) prefs.fokontany = menages.find((m) => cleSegment(m) === prefs.segment)?.fokontany ?? ''
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

  async importerFichier(json) {
    const { valides, ignorees } = lireImportDetail(json)
    const { ecrites, avant } = await importerSuivi(valides)
    const ids = new Set(valides.map((v) => v.id))
    const connus = new Set(get().menages.map((m) => m.id))
    set((s) => ({
      suivi: { ...s.suivi, ...Object.fromEntries(ecrites.map((e) => [e.id, e])) },
      derniere: null,
      restauration: ecrites.length
        ? {
            libelle: `Import : ${ecrites.length} fiche${ecrites.length > 1 ? 's' : ''} mise${ecrites.length > 1 ? 's' : ''} à jour`,
            avant,
            apres: new Map(ecrites.map((e) => [e.id, e])),
          }
        : s.restauration,
    }))
    return {
      lues: ids.size,
      misesAJour: ecrites.length,
      inchangees: ids.size - ecrites.length,
      ignorees,
      // Conservées quand même : la progression est rattachée au code du ménage, pas à sa présence dans le fichier de données.
      inconnues: [...ids].filter((id) => !connus.has(id)).length,
    }
  },

  async toutEffacer() {
    const tous = await lireSuivi()
    await effacerSuivi()
    set({
      suivi: {},
      derniere: null,
      restauration: tous.length
        ? {
            libelle: 'Progression effacée',
            avant: new Map(tous.map((s) => [s.id, s])),
            apres: new Map(tous.map((s) => [s.id, null])),
          }
        : null,
    })
  },

  async annulerRestauration() {
    const r = get().restauration
    if (!r) return { rendues: 0, conservees: 0 }
    const plan = planAnnulation(get().suivi, r.avant, r.apres)
    await appliquerPlan(plan.aEcrire, plan.aSupprimer)
    set((s) => {
      const suivi = { ...s.suivi }
      for (const e of plan.aEcrire) suivi[e.id] = e
      for (const id of plan.aSupprimer) delete suivi[id]
      return { suivi, restauration: null, derniere: null }
    })
    return { rendues: plan.aEcrire.length + plan.aSupprimer.length, conservees: plan.conservees }
  },

  async marquerSauvegarde() {
    await get().definirPref('sauvegarde', new Date().toISOString())
  },

  async definirPref(cle, valeur) {
    await get().definirPrefs({ [cle]: valeur })
  },

  // Plusieurs préférences en une seule écriture (changer de fokontany peut aussi changer de segment).
  async definirPrefs(patch) {
    const prefs = { ...get().prefs, ...patch }
    await ecrirePref('prefs', prefs)
    set({ prefs })
  },

  definirPosition: (position) => set({ position }),
}))
