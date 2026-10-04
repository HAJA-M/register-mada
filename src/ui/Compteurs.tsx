import { LIBELLES, STATUTS, type Statut } from '../types'
import { FOND } from './statuts'

export function Compteurs({ parStatut }: { parStatut: Record<Statut, number> }) {
  return (
    <p className="flex flex-wrap gap-x-3 gap-y-1 px-4 text-xs text-brume">
      {STATUTS.filter((s) => parStatut[s] > 0).map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5">
          <i className={`size-2 rounded-full ${FOND[s]}`} />
          {LIBELLES[s]} <b className="font-semibold text-craie">{parStatut[s]}</b>
        </span>
      ))}
    </p>
  )
}
