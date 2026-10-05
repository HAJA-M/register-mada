import { describe, expect, it } from 'vitest'
import donnees from '../data/tokatrano.json'
import type { Tokatrano } from '../types'
import { emprise } from './geo'
import { dansSegment, segments } from './liste'
import {
  latVersY, listeTuiles, lonVersX, megaoctets, MODELE_TUILES, OCTETS_PAR_TUILE, unir, Z_MAX, Z_MIN,
} from './tuiles'

const menages = donnees as Tokatrano[]

describe('coordonnées de tuile', () => {
  it('connaît les valeurs de référence', () => {
    expect(lonVersX(-180, 0)).toBe(0)
    expect(lonVersX(0, 1)).toBe(1)
    expect(latVersY(0, 1)).toBe(1)
    expect(lonVersX(179.999, 2)).toBe(3)
    expect(latVersY(85.05, 0)).toBe(0)
    // l'équateur est toujours au milieu de la grille
    expect(latVersY(0.0001, 14)).toBe(2 ** 13 - 1)
    expect(latVersY(-0.0001, 14)).toBe(2 ** 13)
    // x = (lon + 180) / 360 × 2^z : 47,5985° à z14 → 227,5985 / 360 × 16384
    expect(lonVersX(47.5985, 14)).toBe(Math.floor((227.5985 / 360) * 16384))
  })
  it('le nord a un y plus petit que le sud', () => {
    expect(latVersY(-18.78, 14)).toBeLessThan(latVersY(-18.80, 14))
  })
})

describe('listeTuiles', () => {
  const e = { sud: -18.80, nord: -18.78, ouest: 47.58, est: 47.60 }

  it('produit des URLs bien formées, du zoom mini au maxi', () => {
    const urls = listeTuiles(e, 'osm')
    expect(urls.every((u) => /^https:\/\/tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/.test(u))).toBe(true)
    const zooms = new Set(urls.map((u) => Number(u.split('/')[3])))
    expect([...zooms].sort((a, b) => a - b)).toEqual(
      Array.from({ length: Z_MAX - Z_MIN + 1 }, (_, i) => Z_MIN + i),
    )
  })
  it('place z, y, x dans l\'ordre propre à chaque fournisseur', () => {
    const sat = listeTuiles(e, 'sat', 14, 14)[0]!
    expect(sat).toMatch(/MapServer\/tile\/14\/\d+\/\d+$/)
    const [, y, x] = sat.match(/tile\/14\/(\d+)\/(\d+)$/)!
    expect(listeTuiles(e, 'osm', 14, 14)[0]).toBe(
      MODELE_TUILES.osm.replace('{z}', '14').replace('{x}', x!).replace('{y}', y!),
    )
  })
  it('quadruple à peu près à chaque niveau de zoom', () => {
    const n = (z: number) => listeTuiles(e, 'osm', z, z).length
    expect(n(18)).toBeGreaterThan(n(17) * 3)
  })
  it('ne contient pas de doublon pour une emprise', () => {
    const urls = listeTuiles(e, 'sat')
    expect(new Set(urls).size).toBe(urls.length)
  })
})

describe('zone réelle', () => {
  const segs = segments(menages)
  const parSegment = segs.map((g) => listeTuiles(emprise(dansSegment(menages, g.cle), 0.004)!, 'sat'))

  it('chaque segment reste un téléchargement raisonnable (< 40 Mo)', () => {
    for (const urls of parSegment) {
      expect(urls.length * OCTETS_PAR_TUILE.sat).toBeLessThan(40_000_000)
    }
  })
  it('l\'union dédoublonne les tuiles partagées et n\'en perd aucune', () => {
    const tout = unir(...parSegment)
    const somme = parSegment.reduce((n, u) => n + u.length, 0)
    expect(tout.length).toBeLessThanOrEqual(somme)
    for (const urls of parSegment) for (const u of urls) expect(tout).toContain(u)
  })
  it('l\'emprise ignore les relevés aberrants : le segment 08/S01 reste petit', () => {
    const s08 = segs.find((g) => g.label === '08/S01')!
    const e08 = emprise(dansSegment(menages, s08.cle))!
    // les deux fiches fausses sont à ~6 km (0,05°) au sud
    expect(e08.nord - e08.sud).toBeLessThan(0.03)
  })
})

describe('megaoctets', () => {
  it.each([
    [16_170_000, '16 Mo'],
    [3_400_000, '3,4 Mo'],
    [0, '0,0 Mo'],
  ])('%s → %s', (o, attendu) => expect(megaoctets(o)).toBe(attendu))
})
