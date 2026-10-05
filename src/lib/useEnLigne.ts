import { useSyncExternalStore } from 'react'

const abonner = (cb: () => void) => {
  addEventListener('online', cb)
  addEventListener('offline', cb)
  return () => {
    removeEventListener('online', cb)
    removeEventListener('offline', cb)
  }
}

/** `navigator.onLine` n'est fiable que dans un sens : « false » est sûr, « true » veut seulement dire « un réseau existe ». */
export const useEnLigne = () => useSyncExternalStore(abonner, () => navigator.onLine, () => true)
