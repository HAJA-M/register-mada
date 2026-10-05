import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from './db'
import { useStore } from './store'

const ID = useStore.getState().menages[0]!.id
const ID2 = useStore.getState().menages[1]!.id
const enBase = (id: string) => db.suivi.get(id)

beforeEach(async () => {
  await db.suivi.clear()
  useStore.setState({ suivi: {}, derniere: null, restauration: null, selection: null, alerte: null })
})

describe('changerStatut', () => {
  it('écrit dans Dexie, préremplit la date et mémorise de quoi annuler', async () => {
    await useStore.getState().changerStatut(ID, 'fait')
    const s = useStore.getState()
    expect(s.suivi[ID]!.statut).toBe('fait')
    expect(s.suivi[ID]!.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(await enBase(ID)).toEqual(s.suivi[ID])
    expect(s.derniere).toEqual({ id: ID, avant: null })
  })

  it('ne préremplit pas la date pour « à faire » et garde une date existante', async () => {
    await useStore.getState().changerStatut(ID, 'todo')
    expect(useStore.getState().suivi[ID]!.date).toBe('')
    await useStore.getState().modifier(ID, { date: '2026-05-01' })
    await useStore.getState().changerStatut(ID, 'refus')
    expect(useStore.getState().suivi[ID]!.date).toBe('2026-05-01')
  })

  it("laisse l\'écran intact si l\'écriture échoue", async () => {
    const put = vi.spyOn(db.suivi, 'put').mockRejectedValueOnce(new Error('boum'))
    await expect(useStore.getState().changerStatut(ID, 'fait')).rejects.toThrow()
    expect(useStore.getState().suivi[ID]).toBeUndefined()
    expect(useStore.getState().derniere).toBeNull()
    put.mockRestore()
  })
})

describe('annuler', () => {
  it("supprime la fiche si elle n\'existait pas avant", async () => {
    await useStore.getState().changerStatut(ID, 'fait')
    await useStore.getState().annuler()
    expect(useStore.getState().suivi[ID]).toBeUndefined()
    expect(await enBase(ID)).toBeUndefined()
    expect(useStore.getState().derniere).toBeNull()
  })

  it('rétablit le statut et la date précédents', async () => {
    await useStore.getState().changerStatut(ID, 'encours')
    const avant = useStore.getState().suivi[ID]!
    await useStore.getState().changerStatut(ID, 'fait')
    await useStore.getState().annuler()
    const apres = (await enBase(ID))!
    expect(apres.statut).toBe('encours')
    expect(apres.date).toBe(avant.date)
    expect(useStore.getState().suivi[ID]).toEqual(apres)
  })

  it('conserve une note tapée après le changement', async () => {
    await useStore.getState().changerStatut(ID, 'fait')
    await useStore.getState().modifier(ID, { note: 'porte bleue' })
    await useStore.getState().annuler()
    const f = (await enBase(ID))!
    expect(f.statut).toBe('todo')
    expect(f.note).toBe('porte bleue')
  })

  it('ne fait rien sans changement à annuler', async () => {
    await useStore.getState().annuler()
    expect(await db.suivi.count()).toBe(0)
  })

  it("n\'annule que le dernier changement", async () => {
    await useStore.getState().changerStatut(ID, 'fait')
    await useStore.getState().changerStatut(ID2, 'refus')
    await useStore.getState().annuler()
    expect(useStore.getState().suivi[ID2]).toBeUndefined()
    expect(useStore.getState().suivi[ID]!.statut).toBe('fait')
  })
})

describe('modifier', () => {
  it('met à jour maj, sans devenir annulable', async () => {
    await useStore.getState().modifier(ID, { note: 'x' })
    const s = useStore.getState()
    expect(s.suivi[ID]!.maj).not.toBe('')
    expect(s.derniere).toBeNull()
  })
})

const ID3 = useStore.getState().menages[2]!.id
const fichier = (...fiches: object[]) => ({ app: 'fanisana', version: 1, suivi: fiches })
const f = (id: string, statut: string, maj: string, note = '') => ({ id, statut, date: '', note, maj })

describe('importerFichier', () => {
  it('fusionne : la fiche la plus récente gagne, les inconnues sont conservées et comptées', async () => {
    await db.suivi.put({ id: ID, statut: 'fait', date: '', note: 'local', maj: '2026-05-02T00:00:00Z' })
    await useStore.getState().hydrater()
    const r = await useStore.getState().importerFichier(
      fichier(
        f(ID, 'refus', '2026-05-01T00:00:00Z', 'plus ancien'), // plus ancien que le local : ignoré
        f(ID2, 'absent', '2026-05-03T00:00:00Z'), // nouveau
        f('RSU/0000/00/S00/1(1/1)', 'fait', '2026-05-03T00:00:00Z'), // sans ménage correspondant
        { id: 'x', statut: 'nimporte-quoi' }, // illisible
      ),
    )
    expect(r).toEqual({ lues: 3, misesAJour: 2, inchangees: 1, ignorees: 1, inconnues: 1 })
    expect((await enBase(ID))!.note).toBe('local')
    expect((await enBase(ID2))!.statut).toBe('absent')
    expect(await enBase('RSU/0000/00/S00/1(1/1)')).toBeDefined()
  })

  it("refuse un fichier qui n'est pas une sauvegarde, sans rien écrire", async () => {
    await expect(useStore.getState().importerFichier('texte')).rejects.toThrow()
    expect(await db.suivi.count()).toBe(0)
  })

  it('un fichier sans aucune nouveauté ne propose rien à annuler', async () => {
    await useStore.getState().changerStatut(ID, 'fait')
    const avant = useStore.getState().suivi[ID]!
    await useStore.getState().importerFichier(fichier(f(ID, 'refus', '2000-01-01T00:00:00Z')))
    expect(useStore.getState().suivi[ID]).toEqual(avant)
    expect(useStore.getState().restauration).toBeNull()
  })

  it("annuler l'import rend l'état d'avant", async () => {
    await useStore.getState().changerStatut(ID, 'encours')
    const avantID = { ...useStore.getState().suivi[ID]! }
    await useStore.getState().importerFichier(
      fichier(f(ID, 'fait', '2099-01-01T00:00:00Z'), f(ID2, 'refus', '2099-01-01T00:00:00Z')),
    )
    expect(useStore.getState().suivi[ID]!.statut).toBe('fait')
    const r = await useStore.getState().annulerRestauration()
    expect(r).toEqual({ rendues: 2, conservees: 0 })
    expect(await enBase(ID)).toEqual(avantID)
    expect(await enBase(ID2)).toBeUndefined()
    expect(useStore.getState().restauration).toBeNull()
  })

  it("annuler l'import ne détruit pas ce qui a été saisi depuis", async () => {
    await useStore.getState().importerFichier(
      fichier(f(ID, 'fait', '2099-01-01T00:00:00Z'), f(ID2, 'refus', '2099-01-01T00:00:00Z')),
    )
    await useStore.getState().modifier(ID2, { note: 'saisi après coup' })
    const r = await useStore.getState().annulerRestauration()
    expect(r).toEqual({ rendues: 1, conservees: 1 })
    expect(await enBase(ID)).toBeUndefined()
    expect((await enBase(ID2))!.note).toBe('saisi après coup')
  })
})

describe('toutEffacer', () => {
  it("efface tout, et l'annulation le rend", async () => {
    await useStore.getState().changerStatut(ID, 'fait')
    await useStore.getState().changerStatut(ID2, 'refus')
    await useStore.getState().modifier(ID3, { note: 'seulement une note' })
    const avant = (await db.suivi.toArray()).sort((a, b) => a.id.localeCompare(b.id))

    await useStore.getState().toutEffacer()
    expect(await db.suivi.count()).toBe(0)
    expect(useStore.getState().suivi).toEqual({})

    const r = await useStore.getState().annulerRestauration()
    expect(r.rendues).toBe(3)
    expect((await db.suivi.toArray()).sort((a, b) => a.id.localeCompare(b.id))).toEqual(avant)
    expect(Object.keys(useStore.getState().suivi)).toHaveLength(3)
  })

  it("après effacement, une fiche resaisie n'est pas écrasée par l'annulation", async () => {
    await useStore.getState().changerStatut(ID, 'fait')
    await useStore.getState().changerStatut(ID2, 'refus')
    await useStore.getState().toutEffacer()
    await useStore.getState().changerStatut(ID, 'absent')
    const r = await useStore.getState().annulerRestauration()
    expect(r).toEqual({ rendues: 1, conservees: 1 })
    expect((await enBase(ID))!.statut).toBe('absent')
    expect((await enBase(ID2))!.statut).toBe('refus')
  })

  it("effacer quand il n'y a rien ne propose rien à annuler", async () => {
    await useStore.getState().toutEffacer()
    expect(useStore.getState().restauration).toBeNull()
  })
})

describe('marquerSauvegarde', () => {
  it('mémorise la date de la dernière sauvegarde dans les préférences', async () => {
    expect(useStore.getState().prefs.sauvegarde).toBe('')
    await useStore.getState().marquerSauvegarde()
    expect(Date.parse(useStore.getState().prefs.sauvegarde)).toBeGreaterThan(Date.now() - 5000)
  })
})
