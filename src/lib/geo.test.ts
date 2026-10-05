import { describe, expect, it } from 'vitest'
import donnees from '../data/tokatrano.json'
import type { Tokatrano } from '../types'
import { cercle, distance, distanceVers, emprise, formatDistance, pointsFiables, qualiteGps } from './geo'

const menages = donnees as Tokatrano[]

describe('distance', () => {
  it('vaut 0 pour un même point', () => {
    expect(distance(-18.79, 47.59, -18.79, 47.59)).toBe(0)
  })

  it('est symétrique', () => {
    const ab = distance(-18.79, 47.59, -18.84, 47.56)
    expect(distance(-18.84, 47.56, -18.79, 47.59)).toBeCloseTo(ab, 6)
  })

  it('compte ~111,2 km par degré de latitude', () => {
    expect(distance(0, 0, 1, 0)).toBeCloseTo(111195, -1)
  })

  it('réduit les degrés de longitude avec la latitude', () => {
    const equateur = distance(0, 47, 0, 48)
    const tana = distance(-18.8, 47, -18.8, 48)
    expect(tana / equateur).toBeCloseTo(Math.cos((18.8 * Math.PI) / 180), 3)
  })

  it('retrouve l\'écart de ~6 km des deux relevés aberrants de la grappe 08', () => {
    const d = distance(-18.7905, 47.5985, -18.8377338, 47.556958)
    expect(d).toBeGreaterThan(6000)
    expect(d).toBeLessThan(7000)
  })
})

describe('distanceVers', () => {
  const m = menages.find((x) => x.lat != null)!
  const sans = { ...m, lat: null, lon: null }

  it('renvoie null sans position', () => {
    expect(distanceVers(null, m)).toBeNull()
  })

  it('renvoie null pour une fiche sans GPS', () => {
    expect(distanceVers({ lat: -18.79, lon: 47.59 }, sans)).toBeNull()
  })

  it('calcule la distance quand tout est connu', () => {
    expect(distanceVers({ lat: m.lat!, lon: m.lon! }, m)).toBe(0)
  })
})

describe('formatDistance', () => {
  it.each([
    [null, ''],
    [0, '0 m'],
    [122, '120 m'],
    [948, '950 m'],
    [950, '1,0 km'],
    [1340, '1,3 km'],
  ])('%s → %s', (d, attendu) => {
    expect(formatDistance(d)).toBe(attendu)
  })
})

describe('emprise et cadrage', () => {
  const aberrants = menages.filter((m) => m.id.startsWith('RSU/0267/08/S01/') && m.lat != null && m.lat < -18.82)

  it('repère les deux fiches de la grappe 08 S01 à ~6 km', () => {
    expect(aberrants.map((m) => m.id).sort()).toEqual([
      'RSU/0267/08/S01/2(2/2)',
      'RSU/0267/08/S01/3(1/1)',
    ])
  })

  it('les exclut des points fiables mais garde toutes les autres fiches géolocalisées', () => {
    const geo = menages.filter((m) => m.lat != null)
    const fiables = pointsFiables(menages)
    expect(fiables).toHaveLength(geo.length - 2)
    for (const a of aberrants) expect(fiables.some((p) => p.id === a.id)).toBe(false)
  })

  it('ne les compte pas dans l\'emprise', () => {
    const e = emprise(menages)!
    expect(e.sud).toBeGreaterThan(-18.82)
    expect(emprise(menages, 0.004)!.sud).toBeCloseTo(e.sud - 0.004, 9)
  })

  it('renvoie null sans aucune fiche géolocalisée', () => {
    expect(emprise(menages.map((m) => ({ ...m, lat: null, lon: null })))).toBeNull()
  })
})

describe('cercle', () => {
  it('forme un anneau fermé de pas + 1 points', () => {
    const c = cercle(47.59, -18.8, 25, 32)
    expect(c).toHaveLength(33)
    expect(c[0]).toEqual(c[32])
  })
  it.each([5, 25, 150, 2000])('chaque point est à %s m du centre', (r) => {
    for (const [lon, lat] of cercle(47.59, -18.8, r)) {
      expect(Math.abs(distance(-18.8, 47.59, lat, lon) - r)).toBeLessThan(r * 0.002 + 0.01)
    }
  })
  it('est centré : les points opposés sont symétriques autour du centre', () => {
    const c = cercle(47.59, -18.8, 100, 4)
    expect((c[0]![1] + c[2]![1]) / 2).toBeCloseTo(-18.8, 5)
    expect((c[1]![0] + c[3]![0]) / 2).toBeCloseTo(47.59, 5)
  })
  it('un rayon nul donne un anneau réduit au centre', () => {
    for (const [lon, lat] of cercle(47.59, -18.8, 0, 8)) {
      expect(lon).toBeCloseTo(47.59, 9)
      expect(lat).toBeCloseTo(-18.8, 9)
    }
  })
})

describe('qualiteGps', () => {
  it.each([
    [3, 'bonne'], [15, 'bonne'], [15.1, 'moyenne'], [50, 'moyenne'], [50.1, 'faible'], [800, 'faible'],
  ])('%s m → %s', (p, q) => expect(qualiteGps(p)).toBe(q))
})
