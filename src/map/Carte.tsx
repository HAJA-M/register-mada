import { useRef } from 'react'
import { useStore } from '../store'
import { MaPosition } from './MaPosition'
import { Reperes } from './Reperes'
import { useMap } from './useMap'

export function Carte() {
  const conteneur = useRef<HTMLDivElement>(null)
  const fond = useStore((s) => s.prefs.fond)
  const map = useMap(conteneur, fond)

  return (
    <>
      <div className="absolute inset-0">
        <div ref={conteneur} className="h-full w-full" />
      </div>
      {map && (
        <>
          <Reperes map={map} />
          <MaPosition map={map} />
        </>
      )}
    </>
  )
}
