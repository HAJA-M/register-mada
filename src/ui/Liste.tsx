import { distanceVers, formatDistance, type Position } from '../lib/geo'
import { statutDe, type SuiviParId } from '../lib/liste'
import type { Tokatrano } from '../types'
import { FOND } from './statuts'

export function Liste({
  lignes, suivi, position, selection, onChoisir,
}: {
  lignes: Tokatrano[]
  suivi: SuiviParId
  position: Position | null
  selection: string | null
  onChoisir: (id: string) => void
}) {
  if (!lignes.length) return <p className="px-4 py-8 text-center text-brume">Aucun tokatrano ne correspond.</p>
  return (
    <ul>
      {lignes.map((m) => {
        const st = statutDe(suivi, m.id)
        const d = distanceVers(position, m)
        return (
          <li key={m.id}>
            <button
              onClick={() => onChoisir(m.id)}
              aria-current={m.id === selection}
              className={`flex min-h-14 w-full items-center gap-3 border-b border-trait px-4 py-2 text-left ${
                m.id === selection ? 'bg-trait' : ''
              }`}
            >
              <span className={`grid size-9 shrink-0 place-items-center rounded-full font-bold text-nuit ${FOND[st]}`}>
                {m.no}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block truncate font-medium ${st === 'fait' ? 'text-brume' : ''}`}>
                  {m.chef || m.surnom || 'Sans nom'}
                </span>
                <span className="block truncate text-xs text-brume">
                  {d != null && <b className="font-semibold text-craie">{formatDistance(d)} · </b>}
                  {m.adresse || '—'} · {m.membres || '?'} pers.
                  {m.lat == null && ' · sans GPS'}
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
