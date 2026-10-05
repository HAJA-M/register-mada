import { describe, expect, it } from 'vitest'
import { verifier, type InscriptionLike } from './miseAJour'

class FauxWorker extends EventTarget {
  constructor(public state: string) {
    super()
  }
  passerA(etat: string) {
    this.state = etat
    this.dispatchEvent(new Event('statechange'))
  }
}

const inscription = (o: Partial<InscriptionLike> & { update?: () => Promise<unknown> } = {}): InscriptionLike => ({
  update: async () => {},
  waiting: null,
  installing: null,
  ...o,
})

describe('verifier', () => {
  it('sans réseau, ne tente rien', async () => {
    let appele = false
    const r = await verifier(inscription({ update: async () => { appele = true } }), false)
    expect(r).toBe('hors-ligne')
    expect(appele).toBe(false)
  })
  it('sans service worker (développement, navigateur sans support)', async () => {
    expect(await verifier(null, true)).toBe('indisponible')
  })
  it('à jour quand rien de nouveau n\'est trouvé', async () => {
    expect(await verifier(inscription(), true)).toBe('a-jour')
  })
  it('disponible quand une version attend déjà', async () => {
    expect(await verifier(inscription({ waiting: {} }), true)).toBe('disponible')
  })
  it('attend la fin de l\'installation d\'une nouvelle version, puis la signale', async () => {
    const w = new FauxWorker('installing')
    const reg = inscription({ installing: w })
    const attente = verifier(reg, true)
    setTimeout(() => {
      reg.waiting = {}
      reg.installing = null
      w.passerA('installed')
    }, 10)
    expect(await attente).toBe('disponible')
  })
  it('une installation avortée est une erreur, pas « à jour »', async () => {
    const w = new FauxWorker('installing')
    const attente = verifier(inscription({ installing: w }), true)
    setTimeout(() => w.passerA('redundant'), 10)
    expect(await attente).toBe('erreur')
  })
  it("ne reste pas bloqué si l'installation ne finit jamais : erreur, pas « à jour »", async () => {
    const w = new FauxWorker('installing')
    expect(await verifier(inscription({ installing: w }), true, 30)).toBe('erreur')
  })
  it('erreur réseau pendant la vérification', async () => {
    const r = await verifier(inscription({ update: async () => { throw new TypeError('Failed to fetch') } }), true)
    expect(r).toBe('erreur')
  })
})
