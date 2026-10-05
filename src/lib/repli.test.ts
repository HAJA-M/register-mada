import { describe, expect, it } from 'vitest'
import absente from './fixtures/esri-absente.jpg?inline'
import { estImageAbsente, lireAdresse, parent, TAILLE_TUILE } from './repli'

describe('parent', () => {
  it('un niveau plus haut : quatre quadrants de 128 px', () => {
    expect(parent(18, 10, 20, 1)).toEqual({ z: 17, x: 5, y: 10, sx: 0, sy: 0, cote: 128 })
    expect(parent(18, 11, 20, 1)).toMatchObject({ x: 5, y: 10, sx: 128, sy: 0 })
    expect(parent(18, 10, 21, 1)).toMatchObject({ x: 5, y: 10, sx: 0, sy: 128 })
    expect(parent(18, 11, 21, 1)).toMatchObject({ x: 5, y: 10, sx: 128, sy: 128 })
  })
  it('deux niveaux : seizièmes de 64 px, le bon coin', () => {
    expect(parent(18, 7, 6, 2)).toEqual({ z: 16, x: 1, y: 1, sx: 3 * 64, sy: 2 * 64, cote: 64 })
  })
  it('les quatre enfants d\'une tuile recouvrent toute la tuile, sans trou ni chevauchement', () => {
    const enfants = [0, 1].flatMap((dx) => [0, 1].map((dy) => parent(18, 8 + dx, 12 + dy, 1)))
    expect(new Set(enfants.map((e) => `${e.z}/${e.x}/${e.y}`)).size).toBe(1)
    const aire = enfants.reduce((s, e) => s + e.cote ** 2, 0)
    expect(aire).toBe(TAILLE_TUILE ** 2)
    expect(new Set(enfants.map((e) => `${e.sx},${e.sy}`)).size).toBe(4)
  })
  it('reste cohérent avec les coordonnées de tuile réelles', () => {
    // la tuile 18/…/… contient exactement 1/4 de la surface de sa parente 17
    const p = parent(18, 123457, 98765, 1)
    expect(p.x).toBe(Math.floor(123457 / 2))
    expect(p.y).toBe(Math.floor(98765 / 2))
  })
})

describe('lireAdresse', () => {
  it('lit z/y/x dans l\'ordre du service Esri', () => {
    expect(lireAdresse('esri://17/8800/10350')).toEqual({ z: 17, y: 8800, x: 10350 })
  })
  it.each(['https://server.arcgisonline.com/17/1/1', 'esri://17/8800', 'esri://a/b/c', ''])('refuse %s', (u) => {
    expect(lireAdresse(u)).toBeNull()
  })
})

// Octets réels renvoyés par Esri pour 19/1/1, 18/9000/10000, etc. (adresse data: lisible par fetch)
const reelle = async () => (await fetch(absente)).arrayBuffer()

describe('estImageAbsente', () => {
  it("reconnaît l'image « Map data not yet available » d'Esri", async () => {
    expect(await estImageAbsente(await reelle())).toBe(true)
  })
  it('un seul octet de différence suffit à la rejeter', async () => {
    const b = new Uint8Array(await reelle())
    b[1000] = b[1000]! ^ 1
    expect(await estImageAbsente(b.buffer)).toBe(false)
  })
  it('ne prend pas une vraie tuile pour l\'image de remplacement', async () => {
    expect(await estImageAbsente(new ArrayBuffer(18_000))).toBe(false)
  })
  it('exige la bonne taille ET la bonne empreinte', async () => {
    expect(await estImageAbsente(new ArrayBuffer(2521))).toBe(false)
  })
})
