import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from './db'
import { useStore } from './store'

const ID = useStore.getState().menages[0]!.id
const ID2 = useStore.getState().menages[1]!.id
const enBase = (id: string) => db.suivi.get(id)

beforeEach(async () => {
  await db.suivi.clear()
  useStore.setState({ suivi: {}, derniere: null, selection: null, alerte: null })
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

  it('laisse l\'écran intact si l\'écriture échoue', async () => {
    const put = vi.spyOn(db.suivi, 'put').mockRejectedValueOnce(new Error('boum'))
    await expect(useStore.getState().changerStatut(ID, 'fait')).rejects.toThrow()
    expect(useStore.getState().suivi[ID]).toBeUndefined()
    expect(useStore.getState().derniere).toBeNull()
    put.mockRestore()
  })
})

describe('annuler', () => {
  it('supprime la fiche si elle n\'existait pas avant', async () => {
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

  it('n\'annule que le dernier changement', async () => {
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
