import { describe, expect, it } from 'vitest'
import type { Suivi } from '../types'
import { planAnnulation, type Instantane } from './restauration'

const f = (id: string, statut: Suivi['statut'], maj: string, note = ''): Suivi => ({ id, statut, date: '', note, maj })
const parId = (...l: Suivi[]) => Object.fromEntries(l.map((x) => [x.id, x]))

describe('planAnnulation', () => {
  it('rend aux fiches importées leur état d\'avant, et supprime celles qui n\'existaient pas', () => {
    const avantA = f('a', 'todo', '2026-01-01T00:00:00Z')
    const apresA = f('a', 'fait', '2026-02-01T00:00:00Z')
    const apresB = f('b', 'refus', '2026-02-01T00:00:00Z')
    const avant: Instantane = new Map([['a', avantA], ['b', null]])
    const apres: Instantane = new Map([['a', apresA], ['b', apresB]])
    const plan = planAnnulation(parId(apresA, apresB), avant, apres)
    expect(plan.aEcrire).toEqual([avantA])
    expect(plan.aSupprimer).toEqual(['b'])
    expect(plan.conservees).toBe(0)
  })

  it('ne touche pas à une fiche modifiée depuis l\'import', () => {
    const avantA = f('a', 'todo', '2026-01-01T00:00:00Z')
    const apresA = f('a', 'fait', '2026-02-01T00:00:00Z')
    const retouchee = f('a', 'absent', '2026-03-01T00:00:00Z', 'repasser demain')
    const plan = planAnnulation(parId(retouchee), new Map([['a', avantA]]), new Map([['a', apresA]]))
    expect(plan).toEqual({ aEcrire: [], aSupprimer: [], conservees: 1 })
  })

  it('une note ajoutée après l\'import suffit à protéger la fiche', () => {
    const apresA = f('a', 'fait', '2026-02-01T00:00:00Z')
    const plan = planAnnulation(parId({ ...apresA, note: 'x' }), new Map([['a', null]]), new Map([['a', apresA]]))
    expect(plan.aSupprimer).toEqual([])
    expect(plan.conservees).toBe(1)
  })

  it('annuler un effacement : restaure les fiches absentes, pas celles recréées depuis', () => {
    const a = f('a', 'fait', '2026-01-01T00:00:00Z')
    const b = f('b', 'refus', '2026-01-01T00:00:00Z')
    const nouvelleB = f('b', 'encours', '2026-04-01T00:00:00Z')
    const avant: Instantane = new Map([['a', a], ['b', b]])
    const apres: Instantane = new Map([['a', null], ['b', null]])
    const plan = planAnnulation(parId(nouvelleB), avant, apres)
    expect(plan.aEcrire).toEqual([a])
    expect(plan.conservees).toBe(1)
  })

  it('ne modifie pas ses arguments', () => {
    const courant = parId(f('a', 'fait', 'x'))
    const copie = structuredClone(courant)
    planAnnulation(courant, new Map([['a', null]]), new Map([['a', courant.a!]]))
    expect(courant).toEqual(copie)
  })
})
