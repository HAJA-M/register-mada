import { statutDe, type SuiviParId } from '../lib/liste'
import { LIBELLES, type Tokatrano } from '../types'
import { FOND } from './statuts'

/** Un trait par ménage, dans l'ordre des numéros. Le bouton fait 36 px de haut, le trait 24 (77 traits de 10 px sur 360 px : la règle des 44 px est intenable ici, le filtre par segment ramène le ruban à une rangée). */
export function Ruban({
  menages, suivi, selection, onChoisir,
}: {
  menages: Tokatrano[]
  suivi: SuiviParId
  selection: string | null
  onChoisir: (id: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-x-0.5 px-4" role="list" aria-label="Ruban de pointage">
      {menages.map((m) => {
        const st = statutDe(suivi, m.id)
        const label = `${m.no} · ${m.chef || m.surnom || 'sans nom'} · ${LIBELLES[st]}`
        return (
          <button
            key={m.id}
            role="listitem"
            title={label}
            aria-label={label}
            aria-current={m.id === selection}
            onClick={() => onChoisir(m.id)}
            className="grid h-9 w-2.5 place-items-center"
          >
            <span
              className={`block h-6 w-full rounded-[2px] ${FOND[st]} ${
                m.id === selection ? 'outline-2 outline-offset-1 outline-craie' : ''
              }`}
            />
          </button>
        )
      })}
    </div>
  )
}
