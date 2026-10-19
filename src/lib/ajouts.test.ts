import { describe, expect, it } from 'vitest'
import { appliquerLocalisations, estListeMenages, lireListeMenages, lireLocalisations } from './ajouts'
import { fokontanys, nomFokontany, segments } from './liste'
import type { Tokatrano } from '../types'

const liste = {
  fokontany: 'Ambohimangakely',
  commune: 'Ambohimangakely',
  district: 'Antananarivo Avaradrano',
  region: 'Analamanga',
  menages: [
    { id: 'LotIIB-035', section: 'Lot II B', lot: 'Lot II B 35', grappe: 'LotIIB-G2', adresse_origine: '35 B II Ambohimangakely', lat: null, lon: null },
    { id: 'LotIIB-035-Bis', section: 'Lot II B', lot: 'Lot II B 35 Bis', grappe: 'LotIIB-G2', adresse_origine: '35 B II Bis Ambohimangakely' },
    { id: 'LotIIB-036', section: 'Lot II B', lot: 'Lot II B 36', grappe: 'LotIIB-G2' },
    { id: 'LotIB-102', section: 'Lot I B', lot: 'Lot I B 102', grappe: 'LotIB-G3' },
    { id: 'LotIIB-035', section: 'Lot II B', lot: 'Lot II B 35', grappe: 'LotIIB-G2' }, // doublon
    { id: 'REPERE-LAVAGE-MAGIC', section: '-', lot: 'Lavage MagIC', grappe: 'repere', note: 'Commerce' },
    { pas: "d'id" },
  ],
}

describe('lireListeMenages', () => {
  const { menages, ignorees } = lireListeMenages(liste)

  it('reconnaît une liste et la distingue d’une sauvegarde', () => {
    expect(estListeMenages(liste)).toBe(true)
    expect(estListeMenages({ suivi: [] })).toBe(false)
    expect(estListeMenages([])).toBe(false)
  })

  it('écarte les doublons et les lignes sans id', () => {
    expect(menages).toHaveLength(5)
    expect(ignorees).toBe(2)
  })

  it('préfixe les id par le fokontany pour ne jamais heurter un code RSU', () => {
    expect(menages[0]!.id).toBe('AMBOHIMANGAKELY/LotIIB-035')
  })

  it('range les ménages par section, et le repère à part', () => {
    expect(segments(menages).map((s) => s.cle)).toEqual([
      'AMBOHIMANGAKELY|Lot II B', 'AMBOHIMANGAKELY|Lot I B', 'AMBOHIMANGAKELY|Repères',
    ])
    expect(fokontanys(menages)).toEqual([{ cle: 'AMBOHIMANGAKELY', label: 'Ambohimangakely', nb: 5 }])
    expect(nomFokontany(menages[0]!.fokontany)).toBe('Ambohimangakely')
  })

  it('affiche un numéro court sur l’épingle et rappelle les voisins de grappe', () => {
    const m = menages.find((x) => x.id.endsWith('035-Bis'))!
    expect(m.no).toBe('35b')
    expect(m.marika).toBe('Mêmes parages que : Lot II B 35, Lot II B 36')
    expect(m.adresse).toBe('35 B II Bis Ambohimangakely')
    expect(menages.find((x) => x.id.endsWith('MAGIC'))!.no).toBe('R')
  })

  it('ne suppose aucun GPS', () => {
    expect(menages.every((m) => m.lat === null && m.lon === null)).toBe(true)
  })

  it('refuse un fichier sans fokontany', () => {
    expect(() => lireListeMenages({ menages: [] })).toThrow()
  })
})

describe('appliquerLocalisations', () => {
  const m = { id: 'a', lat: null, lon: null, precision: null } as unknown as Tokatrano
  it('place la position relevée sans toucher aux autres fiches', () => {
    const autre = { ...m, id: 'b' }
    const [a, b] = appliquerLocalisations([m, autre], { a: { id: 'a', lat: -18.9, lon: 47.6, precision: 8, maj: '' } })
    expect([a!.lat, a!.lon, a!.precision]).toEqual([-18.9, 47.6, 8])
    expect(b).toBe(autre)
    expect(m.lat).toBeNull() // l'original n'est pas muté
  })
})

describe('lireLocalisations', () => {
  it('écarte les coordonnées absentes ou impossibles', () => {
    const l = lireLocalisations({
      localisations: [
        { id: 'a', lat: -18.9, lon: 47.6, precision: 5, maj: 'x' },
        { id: 'b', lat: null, lon: 47.6 },
        { id: 'c', lat: 200, lon: 47.6 },
        { lat: 1, lon: 1 },
      ],
    })
    expect(l.map((x) => x.id)).toEqual(['a'])
  })
})
