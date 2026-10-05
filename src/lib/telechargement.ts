export type Progres = { fait: number; total: number; echecs: number }

export type Resultat = {
  enregistrees: number // nouvelles tuiles écrites
  dejaLa: number
  echecs: number
  annule: boolean
  stockagePlein: boolean
}

/** Le strict nécessaire de `Cache`, pour pouvoir tester avec un cache en mémoire. */
export type CacheLike = {
  match(url: string): Promise<unknown>
  put(url: string, res: Response): Promise<void>
}

const estQuota = (e: unknown) =>
  e instanceof Error && (e.name === 'QuotaExceededError' || /quota/i.test(e.message))

/**
 * Télécharge les tuiles absentes du cache, `concurrence` à la fois.
 * Une tuile qui échoue (réseau, 404) est comptée sans arrêter les autres ;
 * un cache plein arrête tout, car continuer ne ferait qu'échouer pour rien.
 */
export async function telecharger(
  urls: string[],
  cache: CacheLike,
  opts: {
    concurrence?: number
    signal?: AbortSignal
    onProgres?: (p: Progres) => void
    chercher?: (url: string) => Promise<Response>
  } = {},
): Promise<Resultat> {
  const { concurrence = 6, signal, onProgres, chercher = (u) => fetch(u, { mode: 'cors' }) } = opts
  const r: Resultat = { enregistrees: 0, dejaLa: 0, echecs: 0, annule: false, stockagePlein: false }
  let suivante = 0
  let fait = 0

  const avancer = () => {
    fait++
    // Pas à chaque tuile : l'écran n'a pas besoin de 700 rendus.
    if (fait % 5 === 0 || fait === urls.length) onProgres?.({ fait, total: urls.length, echecs: r.echecs })
  }

  const ouvrier = async () => {
    while (suivante < urls.length) {
      if (signal?.aborted) {
        r.annule = true
        return
      }
      if (r.stockagePlein) return
      const url = urls[suivante++]!
      try {
        if (await cache.match(url)) {
          r.dejaLa++
        } else {
          const res = await chercher(url)
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          await cache.put(url, res)
          r.enregistrees++
        }
      } catch (e) {
        if (estQuota(e)) r.stockagePlein = true
        else r.echecs++
      }
      avancer()
    }
  }

  onProgres?.({ fait: 0, total: urls.length, echecs: 0 })
  await Promise.all(Array.from({ length: Math.min(concurrence, urls.length) }, ouvrier))
  return r
}
