import { describe, expect, it, vi } from 'vitest'
import { telecharger, type CacheLike, type Progres } from './telechargement'

const urls = Array.from({ length: 23 }, (_, i) => `https://tuiles.test/${i}.png`)

function cacheEnMemoire(deja: string[] = [], put?: (u: string) => Promise<void>) {
  const m = new Map<string, Response>(deja.map((u) => [u, new Response('x')]))
  const cache: CacheLike = {
    match: async (u) => m.get(u),
    put: async (u, r) => {
      await put?.(u)
      m.set(u, r)
    },
  }
  return { cache, m }
}
const ok = async () => new Response('png')

describe('telecharger', () => {
  it('enregistre toutes les tuiles absentes', async () => {
    const { cache, m } = cacheEnMemoire()
    const r = await telecharger(urls, cache, { chercher: ok })
    expect(r).toMatchObject({ enregistrees: 23, dejaLa: 0, echecs: 0, annule: false, stockagePlein: false })
    expect(m.size).toBe(23)
  })

  it('ne retélécharge pas ce qui est déjà en cache', async () => {
    const { cache } = cacheEnMemoire(urls.slice(0, 10))
    const chercher = vi.fn(ok)
    const r = await telecharger(urls, cache, { chercher })
    expect(r.dejaLa).toBe(10)
    expect(r.enregistrees).toBe(13)
    expect(chercher).toHaveBeenCalledTimes(13)
  })

  it('compte les échecs (réseau, 404) sans arrêter les autres', async () => {
    const { cache, m } = cacheEnMemoire()
    const chercher = async (u: string) => {
      if (u.endsWith('/3.png')) throw new TypeError('réseau')
      if (u.endsWith('/7.png')) return new Response('', { status: 404 })
      return new Response('png')
    }
    const r = await telecharger(urls, cache, { chercher })
    expect(r.echecs).toBe(2)
    expect(r.enregistrees).toBe(21)
    expect(m.has(urls[3]!)).toBe(false)
  })

  it('permet de compléter : une seconde passe ne récupère que les manquantes', async () => {
    const { cache } = cacheEnMemoire()
    let casse = true
    const chercher = async (u: string) => {
      if (casse && u.endsWith('/5.png')) throw new TypeError('réseau')
      return new Response('png')
    }
    expect((await telecharger(urls, cache, { chercher })).echecs).toBe(1)
    casse = false
    const r = await telecharger(urls, cache, { chercher })
    expect(r).toMatchObject({ enregistrees: 1, dejaLa: 22, echecs: 0 })
  })

  it('s\'arrête net quand le stockage est plein', async () => {
    const { cache } = cacheEnMemoire([], async () => {
      const e = new Error('plein')
      e.name = 'QuotaExceededError'
      throw e
    })
    const chercher = vi.fn(ok)
    const r = await telecharger(urls, cache, { chercher, concurrence: 2 })
    expect(r.stockagePlein).toBe(true)
    expect(r.echecs).toBe(0)
    expect(chercher.mock.calls.length).toBeLessThan(urls.length)
  })

  it('s\'arrête sur demande et signale l\'annulation', async () => {
    const { cache, m } = cacheEnMemoire()
    const ctl = new AbortController()
    const chercher = async () => {
      ctl.abort()
      return new Response('png')
    }
    const r = await telecharger(urls, cache, { chercher, concurrence: 1, signal: ctl.signal })
    expect(r.annule).toBe(true)
    expect(m.size).toBeLessThan(urls.length)
  })

  it('rapporte la progression, jusqu\'au total', async () => {
    const { cache } = cacheEnMemoire()
    const vus: Progres[] = []
    await telecharger(urls, cache, { chercher: ok, onProgres: (p) => vus.push(p) })
    expect(vus[0]).toEqual({ fait: 0, total: 23, echecs: 0 })
    expect(vus.at(-1)).toMatchObject({ fait: 23, total: 23 })
    expect(vus.every((p, i) => i === 0 || p.fait >= vus[i - 1]!.fait)).toBe(true)
  })

  it('gère une liste vide', async () => {
    const { cache } = cacheEnMemoire()
    expect(await telecharger([], cache, { chercher: ok })).toMatchObject({ enregistrees: 0, echecs: 0 })
  })
})
