import { describe, expect, it } from 'vitest'
import donnees from '../data/tokatrano.json'
import type { Statut, Suivi, Tokatrano } from '../types'
import {
  compter, dansPortee, dansSegment, filtrer, fokontanys, nomFokontany, plusProcheOuvert, segmentParDefaut, segments,
  trierParDistance, type SuiviParId,
} from './liste'

const base = donnees[0] as Tokatrano
const fiche = (id: string, o: Partial<Tokatrano> = {}): Tokatrano => ({
  ...base, id, no: id, chef: '', surnom: '', adresse: '', marika: '', lat: null, lon: null, ...o,
})
const suivi = (o: Record<string, Statut>): SuiviParId =>
  Object.fromEntries(Object.entries(o).map(([id, statut]): [string, Suivi] => [id, { id, statut, date: '', note: '', maj: 'x' }]))

// Pas de 0,001° de latitude ≈ 111 m
const a = fiche('a', { lat: -18.80, lon: 47.59, chef: 'Rakotô Jean' })
const b = fiche('b', { lat: -18.801, lon: 47.59, adresse: 'lot II J 15' })
const c = fiche('c', { lat: -18.805, lon: 47.59, marika: 'trano boriky' })
const sansGps = fiche('d', { surnom: 'Tiana' })
const tous = [a, b, c, sansGps]

describe('filtrer', () => {
  it('cherche sans tenir compte des accents ni de la casse', () => {
    expect(filtrer(tous, {}, { recherche: 'RAKOTO', filtre: 'tous' })).toEqual([a])
  })
  it('cherche dans le nom, le surnom, l\'adresse et le repère', () => {
    expect(filtrer(tous, {}, { recherche: 'tiana', filtre: 'tous' })).toEqual([sansGps])
    expect(filtrer(tous, {}, { recherche: 'lot ii', filtre: 'tous' })).toEqual([b])
    expect(filtrer(tous, {}, { recherche: 'boriky', filtre: 'tous' })).toEqual([c])
  })
  it('« reste » garde à faire et en cours, un statut précis ne garde que lui', () => {
    const s = suivi({ a: 'fait', b: 'encours', c: 'refus' })
    expect(filtrer(tous, s, { recherche: '', filtre: 'reste' }).map((m) => m.id)).toEqual(['b', 'd'])
    expect(filtrer(tous, s, { recherche: '', filtre: 'refus' })).toEqual([c])
  })
})

describe('trierParDistance', () => {
  const me = { lat: -18.8049, lon: 47.59 }
  it('place le plus proche en premier et les fiches sans GPS à la fin', () => {
    expect(trierParDistance(tous, me).map((m) => m.id)).toEqual(['c', 'b', 'a', 'd'])
  })
  it('conserve l\'ordre sans position et ne modifie pas l\'entrée', () => {
    const copie = [...tous]
    expect(trierParDistance(tous, null)).toEqual(tous)
    expect(tous).toEqual(copie)
    trierParDistance(tous, me)
    expect(tous).toEqual(copie)
  })
})

describe('plusProcheOuvert', () => {
  const me = { lat: -18.8049, lon: 47.59 }
  it('ignore les terminés, refusés et absents', () => {
    const s = suivi({ c: 'fait', b: 'refus' })
    expect(plusProcheOuvert(tous, s, me)).toBe(a)
  })
  it('ignore les fiches sans GPS', () => {
    expect(plusProcheOuvert([sansGps], {}, me)).toBeNull()
  })
  it('sans position, prend le premier ouvert géolocalisé', () => {
    expect(plusProcheOuvert(tous, suivi({ a: 'fait' }), null)).toBe(b)
  })
  it('un ménage en cours reste candidat', () => {
    expect(plusProcheOuvert(tous, suivi({ c: 'encours' }), me)).toBe(c)
  })
  it('`sauf` écarte le ménage en cours de visite', () => {
    expect(plusProcheOuvert(tous, {}, me, 'c')).toBe(b)
    expect(plusProcheOuvert([a], {}, me, 'a')).toBeNull()
  })
  it('renvoie null quand tout est traité', () => {
    expect(plusProcheOuvert(tous, suivi({ a: 'fait', b: 'fait', c: 'absent' }), me)).toBeNull()
  })
})

describe('compter, segments', () => {
  it('compte par statut, « à faire » par défaut', () => {
    const r = compter(tous, suivi({ a: 'fait', b: 'encours' }))
    expect(r.parStatut).toEqual({ todo: 2, encours: 1, fait: 1, refus: 0, absent: 0 })
    expect(r.reste).toBe(3)
  })
  it('liste les 4 segments réels et sait les isoler', () => {
    const m = donnees as Tokatrano[]
    const seg = segments(m)
    expect(seg).toHaveLength(4)
    expect(dansSegment(m, seg[0]!.cle).length).toBeGreaterThan(0)
    expect(dansSegment(m, '')).toBe(m)
  })
})

describe('segmentParDefaut', () => {
  const m = donnees as Tokatrano[]
  const seg = segments(m)
  const toutFait = (cles: string[]) =>
    suivi(Object.fromEntries(dansSegment(m, '').filter((x) => cles.includes(`${x.grappe}|${x.segment}`)).map((x) => [x.id, 'fait' as Statut])))

  it('prend le premier segment avec du travail', () => {
    expect(segmentParDefaut(m, {})).toBe(seg[0]!.cle)
  })
  it('saute les segments terminés', () => {
    expect(segmentParDefaut(m, toutFait([seg[0]!.cle]))).toBe(seg[1]!.cle)
  })
  it('revient sur « Tous » quand tout est traité', () => {
    expect(segmentParDefaut(m, toutFait(seg.map((g) => g.cle)))).toBe('')
  })
})

describe('fokontany', () => {
  const m = donnees as Tokatrano[]

  it('lisible : sans code ni majuscules', () => {
    expect(nomFokontany('ANTANAMBAO_11061608')).toBe('Antanambao')
    expect(nomFokontany('AMBOHITRANTENAINA_11061605')).toBe('Ambohitrantenaina')
  })
  it('liste les 3 fokontany réels avec leur effectif', () => {
    const f = fokontanys(m)
    expect(f.map((x) => x.label)).toEqual(['Ambohitrantenaina', 'Antanambao', 'Ambatomitsangana'])
    expect(f.map((x) => x.nb)).toEqual([21, 41, 15])
    expect(f.reduce((n, x) => n + x.nb, 0)).toBe(m.length)
  })
  it('Antanambao regroupe deux segments', () => {
    const antanambao = fokontanys(m)[1]!.cle
    const segs = segments(dansPortee(m, { fokontany: antanambao, segment: '' }))
    expect(segs.map((g) => g.label)).toEqual(['08/S01', '08/S02'])
  })
  it('dansPortee : aucune restriction, un fokontany, un segment, les deux', () => {
    const [amb, ant] = fokontanys(m)
    const segsAnt = segments(dansPortee(m, { fokontany: ant!.cle, segment: '' }))
    expect(dansPortee(m, { fokontany: '', segment: '' })).toBe(m)
    expect(dansPortee(m, { fokontany: amb!.cle, segment: '' })).toHaveLength(21)
    expect(dansPortee(m, { fokontany: ant!.cle, segment: '' })).toHaveLength(41)
    expect(dansPortee(m, { fokontany: ant!.cle, segment: segsAnt[1]!.cle })).toHaveLength(13)
    expect(dansPortee(m, { fokontany: '', segment: segsAnt[1]!.cle })).toHaveLength(13)
  })
  it('un segment hors du fokontany choisi ne donne rien', () => {
    const [amb] = fokontanys(m)
    const autre = segments(m).find((g) => g.fokontany !== amb!.cle)!
    expect(dansPortee(m, { fokontany: amb!.cle, segment: autre.cle })).toEqual([])
  })
})
