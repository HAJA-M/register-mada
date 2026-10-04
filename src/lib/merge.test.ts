import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, importerSuivi } from '../db'
import type { Suivi } from '../types'
import { fusionner, lireImport } from './merge'

const s = (id: string, statut: Suivi['statut'], maj: string, note = ''): Suivi => ({
  id, statut, date: '', note, maj,
})

describe('fusionner', () => {
  it('ajoute une fiche absente en local', () => {
    const r = fusionner([], [s('a', 'fait', '2026-01-01T00:00:00Z')])
    expect(r.map((x) => x.id)).toEqual(['a'])
  })

  it('prend l\'entrante si sa maj est plus récente', () => {
    const r = fusionner([s('a', 'todo', '2026-01-01T00:00:00Z')], [s('a', 'fait', '2026-01-02T00:00:00Z')])
    expect(r[0]!.statut).toBe('fait')
  })

  it('garde le local si sa maj est plus récente', () => {
    expect(fusionner([s('a', 'fait', '2026-01-02T00:00:00Z')], [s('a', 'todo', '2026-01-01T00:00:00Z')])).toEqual([])
  })

  it('garde le local à égalité de maj', () => {
    const t = '2026-01-01T00:00:00Z'
    expect(fusionner([s('a', 'fait', t)], [s('a', 'refus', t)])).toEqual([])
  })

  it('prend l\'entrante si le local n\'a pas de maj', () => {
    expect(fusionner([s('a', 'todo', '')], [s('a', 'fait', '2026-01-01T00:00:00Z')])).toHaveLength(1)
  })

  it('garde le local si l\'entrante n\'a pas de maj', () => {
    expect(fusionner([s('a', 'fait', '2026-01-01T00:00:00Z')], [s('a', 'todo', '')])).toEqual([])
  })

  it('arbitre entre doublons d\'un même fichier, la plus récente gagne', () => {
    const r = fusionner([], [s('a', 'encours', '2026-01-01T00:00:00Z'), s('a', 'fait', '2026-01-03T00:00:00Z'), s('a', 'refus', '2026-01-02T00:00:00Z')])
    expect(r).toHaveLength(1)
    expect(r[0]!.statut).toBe('fait')
  })

  it('ne touche pas aux fiches locales absentes du fichier ni aux arguments', () => {
    const locales = [s('a', 'fait', '2026-01-01T00:00:00Z'), s('b', 'fait', '2026-01-01T00:00:00Z')]
    const copie = structuredClone(locales)
    const r = fusionner(locales, [s('b', 'refus', '2026-02-01T00:00:00Z')])
    expect(r.map((x) => x.id)).toEqual(['b'])
    expect(locales).toEqual(copie)
  })
})

describe('lireImport', () => {
  it('lit le dictionnaire du prototype (id = clé, maj parfois absente)', () => {
    const r = lireImport({
      app: 'fanisana', version: 1,
      suivi: {
        'RSU/0267/05/S01/1(1/1)': { statut: 'fait', date: '2026-05-01', note: 'ok', maj: '2026-05-01T08:00:00.000Z' },
        'RSU/0267/05/S01/2(1/1)': { statut: 'refus', date: '', note: '' },
      },
    })
    expect(r).toEqual([
      { id: 'RSU/0267/05/S01/1(1/1)', statut: 'fait', date: '2026-05-01', note: 'ok', maj: '2026-05-01T08:00:00.000Z' },
      { id: 'RSU/0267/05/S01/2(1/1)', statut: 'refus', date: '', note: '', maj: '' },
    ])
  })

  it('lit un tableau de fiches et accepte l\'enveloppe', () => {
    expect(lireImport({ suivi: [s('a', 'fait', 'x')] })).toHaveLength(1)
    expect(lireImport([s('a', 'fait', 'x')])).toHaveLength(1)
  })

  it('ignore les statuts inconnus et les entrées malformées', () => {
    const r = lireImport({ suivi: { a: { statut: 'bizarre' }, b: null, c: 'x', d: { statut: 'fait' } } })
    expect(r.map((x) => x.id)).toEqual(['d'])
  })

  it('rejette un fichier qui n\'est pas un objet', () => {
    expect(() => lireImport('texte')).toThrow()
    expect(() => lireImport(null)).toThrow()
  })
})

describe('importerSuivi (Dexie)', () => {
  beforeEach(async () => {
    await db.suivi.clear()
  })

  it('écrit seulement les fiches gagnantes et conserve le reste', async () => {
    await db.suivi.bulkPut([
      s('a', 'fait', '2026-01-05T00:00:00Z', 'local'),
      s('b', 'todo', '2026-01-01T00:00:00Z'),
      s('c', 'encours', '2026-01-01T00:00:00Z'),
    ])
    const ecrites = await importerSuivi([
      s('a', 'refus', '2026-01-01T00:00:00Z', 'ancien'),
      s('b', 'fait', '2026-01-02T00:00:00Z'),
      s('d', 'absent', '2026-01-02T00:00:00Z'),
    ])
    expect(ecrites.map((x) => x.id).sort()).toEqual(['b', 'd'])
    const tout = Object.fromEntries((await db.suivi.toArray()).map((x) => [x.id, x]))
    expect(tout.a!.note).toBe('local')
    expect(tout.b!.statut).toBe('fait')
    expect(tout.c!.statut).toBe('encours')
    expect(tout.d!.statut).toBe('absent')
  })
})
