import type { Suivi } from '../types'

/** État de fiches à un instant donné ; `null` = la fiche n'existait pas. */
export type Instantane = Map<string, Suivi | null>

const egal = (a: Suivi | null, b: Suivi | null) =>
  a === b ||
  (a !== null && b !== null && a.statut === b.statut && a.date === b.date && a.note === b.note && a.maj === b.maj)

/**
 * Plan pour défaire une opération groupée (import, effacement) : on rend à chaque fiche son état d'avant,
 * SAUF si elle a été modifiée depuis. Annuler un import trois heures plus tard ne doit pas écraser ce que
 * l'enquêteur a saisi entre-temps.
 */
export function planAnnulation(courant: Record<string, Suivi>, avant: Instantane, apres: Instantane) {
  const aEcrire: Suivi[] = []
  const aSupprimer: string[] = []
  let conservees = 0
  for (const [id, voulu] of apres) {
    if (!egal(courant[id] ?? null, voulu)) {
      conservees++
      continue
    }
    const ancien = avant.get(id) ?? null
    if (ancien) aEcrire.push(ancien)
    else aSupprimer.push(id)
  }
  return { aEcrire, aSupprimer, conservees }
}
