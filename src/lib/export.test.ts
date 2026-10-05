import { describe, expect, it } from 'vitest'
import donnees from '../data/tokatrano.json'
import type { Suivi, Tokatrano } from '../types'
import { horodatage, nomFichier, versCsv, versJson } from './export'
import { lireImportDetail } from './merge'

const menages = donnees as Tokatrano[]
const base = menages[0]!
const fiche = (o: Partial<Tokatrano>): Tokatrano => ({ ...base, ...o })
const suivi = (id: string, o: Partial<Suivi> = {}): Suivi => ({
  id, statut: 'fait', date: '2026-05-01', note: '', maj: '2026-05-01T08:00:00.000Z', ...o,
})

describe('versJson', () => {
  it('se relit sans perte avec lireImport', () => {
    const fiches = [suivi('a', { note: 'porte bleue; « chien »\nretour 15h' }), suivi('b', { statut: 'refus' })]
    const relu = lireImportDetail(JSON.parse(versJson(fiches)))
    expect(relu.valides).toEqual(fiches)
    expect(relu.ignorees).toBe(0)
  })
  it("identifie l'application et date l'export", () => {
    const j = JSON.parse(versJson([], new Date('2026-10-05T03:30:00Z')))
    expect(j).toMatchObject({ app: 'fanisana', version: 1, exporte: '2026-10-05T03:30:00.000Z', suivi: [] })
  })
})

describe('versCsv', () => {
  const lignes = (csv: string) => csv.replace(/^﻿/, '').trimEnd().split('\r\n')

  it('commence par un BOM UTF-8 (accents dans Excel), sépare par « ; » et termine les lignes en CRLF', () => {
    const csv = versCsv(menages, {})
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(lignes(csv)[0]).toBe(
      'Kaody_tokatrano;Grappe;Segment;Fokontany;N_tokatrano;Chef_de_menage;Surnom;Membres;Adresse;Latitude;Longitude;Statut;Date_visite;Note;Derniere_maj',
    )
    expect(csv.endsWith('\r\n')).toBe(true)
  })
  it("une ligne par ménage, avec « À faire » quand rien n'a été saisi", () => {
    const l = lignes(versCsv(menages, {}))
    expect(l).toHaveLength(menages.length + 1)
    expect(l[1]).toContain('"À faire"')
  })
  it('écrit le statut, la date et la note saisis', () => {
    const m = fiche({ id: 'X/1' })
    const l = lignes(versCsv([m], { 'X/1': suivi('X/1', { statut: 'refus', note: 'a dit non' }) }))[1]!
    expect(l).toContain('"Refus";"2026-05-01";"a dit non"')
  })
  it("protège les guillemets, points-virgules et retours à la ligne d'une note", () => {
    const m = fiche({ id: 'X/1' })
    const l = versCsv([m], { 'X/1': suivi('X/1', { note: 'dit "non"; revenir\nlundi' }) })
    expect(l).toContain('"dit ""non""; revenir\nlundi"')
  })
  it('neutralise les formules dans les textes, mais pas les coordonnées négatives', () => {
    const m = fiche({ id: 'X/1', chef: '=HYPERLINK("http://x")', surnom: '-1', lat: -18.8, lon: 47.59 })
    const l = lignes(versCsv([m], { 'X/1': suivi('X/1', { note: '@cmd' }) })).slice(1).join('\n')
    expect(l).toContain(`"'=HYPERLINK(""http://x"")"`)
    expect(l).toContain(`"'-1"`)
    expect(l).toContain(`"'@cmd"`)
    expect(l).toContain(';"-18.8";"47.59";')
  })
  it('laisse vides les coordonnées des fiches sans GPS', () => {
    const m = fiche({ id: 'X/1', lat: null, lon: null })
    expect(lignes(versCsv([m], {}))[1]).toContain(';"";"";')
  })
})

describe('noms de fichier', () => {
  it('horodatage en heure locale, sans caractère interdit', () => {
    const d = new Date(2026, 9, 5, 6, 3)
    expect(horodatage(d)).toBe('2026-10-05-0603')
    expect(nomFichier('progression', 'json', d)).toBe('fanisana-progression-2026-10-05-0603.json')
  })
})
