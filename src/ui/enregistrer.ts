import { QuotaError } from '../db'
import { useStore } from '../store'

/** Lance une écriture ; si elle échoue, l'écran ne bouge pas et l'utilisateur en est prévenu. */
export async function enregistrer(op: () => Promise<unknown>): Promise<boolean> {
  try {
    await op()
    return true
  } catch (e) {
    useStore.getState().alerter(
      e instanceof QuotaError
        ? "Mémoire du téléphone pleine : ce changement n'est pas enregistré. Exportez la progression puis libérez de la place."
        : "Ce changement n'a pas pu être enregistré. Réessayez.",
    )
    return false
  }
}

export const vibrer = (ms = 18) => {
  if ('vibrate' in navigator) navigator.vibrate(ms)
}
