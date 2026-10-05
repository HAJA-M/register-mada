export type Verification = 'a-jour' | 'disponible' | 'hors-ligne' | 'indisponible' | 'erreur'

/** Le strict nécessaire d'un `ServiceWorkerRegistration`, pour pouvoir le simuler dans les tests. */
export type InscriptionLike = {
  update(): Promise<unknown>
  waiting: unknown | null
  installing: (EventTarget & { state: string }) | null
}

const FINIS = ['installed', 'activated', 'redundant']

/** Attend que le nouveau service worker ait fini de télécharger l'application (ou échoué). */
function attendreInstallation(sw: EventTarget & { state: string }, delaiMs: number): Promise<'fini' | 'delai'> {
  return new Promise((resultat) => {
    if (FINIS.includes(sw.state)) return resultat('fini')
    const fin = (r: 'fini' | 'delai') => {
      clearTimeout(minuteur)
      sw.removeEventListener('statechange', suivre)
      resultat(r)
    }
    const suivre = () => FINIS.includes(sw.state) && fin('fini')
    const minuteur = setTimeout(() => fin('delai'), delaiMs)
    sw.addEventListener('statechange', suivre)
  })
}

/**
 * Demande au navigateur s'il existe une nouvelle version et attend le résultat.
 * « disponible » : la nouvelle version est téléchargée et n'attend que l'accord de l'utilisateur.
 */
export async function verifier(
  inscription: InscriptionLike | null,
  enLigne: boolean,
  delaiMs = 60_000,
): Promise<Verification> {
  if (!enLigne) return 'hors-ligne'
  if (!inscription) return 'indisponible'
  try {
    await inscription.update()
    const nouveau = inscription.installing
    if (nouveau) {
      const fin = await attendreInstallation(nouveau, delaiMs)
      // Avortée (réseau coupé en route, fichier absent…) ou trop longue : on ne peut pas affirmer « à jour ».
      if (fin === 'delai' || nouveau.state === 'redundant') return 'erreur'
    }
    return inscription.waiting ? 'disponible' : 'a-jour'
  } catch {
    return 'erreur'
  }
}
