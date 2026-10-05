import { statutDe, type SuiviParId } from '../lib/liste'
import { LIBELLES, type Tokatrano } from '../types'
import { FOND } from './statuts'

// Au-delà, les traits ne tiennent plus sur une rangée de 340 px sans devenir trop étroits.
const UNE_RANGEE = 28

/**
 * Un trait par ménage, dans l'ordre des numéros.
 * Un segment tient sur une rangée (traits de 44 px de haut, larges comme la place le permet).
 * « Tous » (77 traits) passe sur trois rangées plus serrées : la règle des 44 px n'y est pas tenable.
 */
export function Ruban({
  menages, suivi, selection, onChoisir,
}: {
  menages: Tokatrano[]
  suivi: SuiviParId
  selection: string | null
  onChoisir: (id: string) => void
}) {
  const serre = menages.length > UNE_RANGEE
  return (
    <div className={`flex px-4 ${serre ? 'flex-wrap gap-x-0.5' : 'gap-0.5'}`} role="list" aria-label="Ruban de pointage">
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
            className={`grid place-items-center ${serre ? 'h-9 w-2.5' : 'h-11 max-w-5 flex-1'}`}
          >
            <span
              className={`block w-full rounded-[3px] ${serre ? 'h-6' : 'h-8'} ${FOND[st]} ${
                m.id === selection ? 'outline-2 outline-offset-1 outline-craie' : ''
              } ${st === 'fait' ? 'tick-fait' : ''}`}
            />
          </button>
        )
      })}
    </div>
  )
}
