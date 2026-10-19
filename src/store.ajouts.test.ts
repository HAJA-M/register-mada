import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { versJson } from './lib/export'
import { useStore } from './store'

const liste = {
  fokontany: 'Ambohimangakely',
  menages: [
    { id: 'LotIIB-035', section: 'Lot II B', lot: 'Lot II B 35', grappe: 'G2' },
    { id: 'LotIIB-036', section: 'Lot II B', lot: 'Lot II B 36', grappe: 'G2' },
  ],
}
const ID = 'AMBOHIMANGAKELY/LotIIB-035'
const NB_BASE = 77

beforeEach(async () => {
  await Promise.all([db.suivi.clear(), db.ajouts.clear(), db.localisations.clear(), db.prefs.clear()])
  useStore.setState({ suivi: {}, ajouts: [], localisations: {}, derniereLoc: null, restauration: null })
  await useStore.getState().hydrater()
})

describe('import de liste', () => {
  it('ajoute les ménages en base sans toucher au dénombrement et bascule sur le fokontany', async () => {
    const r = await useStore.getState().importerFichier(liste)
    expect(r).toMatchObject({ type: 'liste', ajoutes: 2, misAJour: 0, fokontany: 'AMBOHIMANGAKELY' })
    const s = useStore.getState()
    expect(s.menages).toHaveLength(NB_BASE + 2)
    expect(await db.ajouts.count()).toBe(2)
    expect(s.prefs.fokontany).toBe('AMBOHIMANGAKELY')
  })

  it('réimporter met à jour sans dupliquer', async () => {
    await useStore.getState().importerFichier(liste)
    const r = await useStore.getState().importerFichier(liste)
    expect(r).toMatchObject({ ajoutes: 0, misAJour: 2 })
    expect(useStore.getState().menages).toHaveLength(NB_BASE + 2)
  })

  it('les ajouts survivent à un redémarrage', async () => {
    await useStore.getState().importerFichier(liste)
    useStore.setState({ ajouts: [], menages: [] })
    await useStore.getState().hydrater()
    expect(useStore.getState().menages.some((m) => m.id === ID)).toBe(true)
    expect(useStore.getState().prefs.fokontany).toBe('AMBOHIMANGAKELY')
  })
})

describe('localiser', () => {
  beforeEach(() => useStore.getState().importerFichier(liste))

  it('place le ménage et persiste la position', async () => {
    await useStore.getState().localiser(ID, { lat: -18.905, lon: 47.6, precision: 9 })
    const m = useStore.getState().menages.find((x) => x.id === ID)!
    expect([m.lat, m.lon, m.precision]).toEqual([-18.905, 47.6, 9])
    expect((await db.localisations.get(ID))!.lat).toBe(-18.905)
  })

  it('s’annule, y compris une correction', async () => {
    await useStore.getState().localiser(ID, { lat: -18.9, lon: 47.6, precision: 9 })
    await useStore.getState().localiser(ID, { lat: -18.8, lon: 47.5, precision: 30 })
    await useStore.getState().annulerLocalisation()
    expect(useStore.getState().menages.find((x) => x.id === ID)!.lat).toBe(-18.9)
    expect((await db.localisations.get(ID))!.lat).toBe(-18.9)
  })

  it('annuler la première position rend le ménage à nouveau sans GPS', async () => {
    await useStore.getState().localiser(ID, { lat: -18.9, lon: 47.6, precision: 9 })
    await useStore.getState().annulerLocalisation()
    expect(useStore.getState().menages.find((x) => x.id === ID)!.lat).toBeNull()
    expect(await db.localisations.get(ID)).toBeUndefined()
  })
})

describe('sauvegarde complète', () => {
  it('restaure ajouts, positions et statuts sur un téléphone vierge', async () => {
    await useStore.getState().importerFichier(liste)
    await useStore.getState().localiser(ID, { lat: -18.9, lon: 47.6, precision: 9 })
    await useStore.getState().changerStatut(ID, 'fait')
    const s = useStore.getState()
    const fichier = JSON.parse(
      versJson(Object.values(s.suivi), new Date(), { ajouts: s.ajouts, localisations: Object.values(s.localisations) }),
    )

    await Promise.all([db.suivi.clear(), db.ajouts.clear(), db.localisations.clear(), db.prefs.clear()])
    useStore.setState({ suivi: {}, ajouts: [], localisations: {} })
    await useStore.getState().hydrater()
    expect(useStore.getState().menages).toHaveLength(NB_BASE)

    const r = await useStore.getState().importerFichier(fichier)
    expect(r).toMatchObject({ misesAJour: 1, inconnues: 0, positions: 1 })
    const apres = useStore.getState()
    expect(apres.menages.find((x) => x.id === ID)!.lat).toBe(-18.9)
    expect(apres.suivi[ID]!.statut).toBe('fait')
  })

  it('une position plus récente ici n’est pas écrasée par une vieille sauvegarde', async () => {
    await useStore.getState().importerFichier(liste)
    await useStore.getState().localiser(ID, { lat: -18.9, lon: 47.6, precision: 9 })
    const r = await useStore.getState().importerFichier({
      suivi: [],
      localisations: [{ id: ID, lat: -1, lon: 1, precision: 5, maj: '2020-01-01T00:00:00Z' }],
    })
    expect(r).not.toHaveProperty('positions')
    expect(useStore.getState().menages.find((x) => x.id === ID)!.lat).toBe(-18.9)
  })
})
