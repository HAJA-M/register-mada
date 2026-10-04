import { useMemo, useState } from 'react'
import {
  compter, dansSegment, filtrer, plusProcheOuvert, segments, trierParDistance, type Filtre,
} from '../lib/liste'
import { distanceVers, formatDistance } from '../lib/geo'
import { useStore } from '../store'
import { LIBELLES, STATUTS } from '../types'
import { Compteurs } from './Compteurs'
import { Liste } from './Liste'
import { Ruban } from './Ruban'

const champ = 'min-h-11 rounded-[10px] border border-trait bg-nuit px-3 text-craie'

export function Feuille() {
  const menages = useStore((s) => s.menages)
  const suivi = useStore((s) => s.suivi)
  const position = useStore((s) => s.position)
  const selection = useStore((s) => s.selection)
  const { segment, tri } = useStore((s) => s.prefs)
  const selectionner = useStore((s) => s.selectionner)
  const definirPref = useStore((s) => s.definirPref)

  const [ouverte, setOuverte] = useState(false)
  const [recherche, setRecherche] = useState('')
  const [filtre, setFiltre] = useState<Filtre>('tous')

  const portee = useMemo(() => dansSegment(menages, segment), [menages, segment])
  const { parStatut, reste } = useMemo(() => compter(portee, suivi), [portee, suivi])
  const groupes = useMemo(() => segments(menages), [menages])
  const suivant = useMemo(() => plusProcheOuvert(portee, suivi, position), [portee, suivi, position])
  const lignes = useMemo(() => {
    const f = filtrer(portee, suivi, { recherche, filtre })
    return tri === 'dist' ? trierParDistance(f, position) : f
  }, [portee, suivi, recherche, filtre, tri, position])

  const choisir = (id: string) => {
    selectionner(id)
    setOuverte(false)
  }
  const changerTri = () => {
    if (tri === 'num' && !position) return
    void definirPref('tri', tri === 'num' ? 'dist' : 'num').catch(() => {})
  }
  const dSuivant = suivant ? distanceVers(position, suivant) : null

  return (
    <section
      aria-label="Ménages"
      className={`absolute inset-x-0 bottom-0 flex flex-col rounded-t-[14px] border-t border-trait bg-ardoise pb-[env(safe-area-inset-bottom)] ${
        ouverte ? 'h-[78dvh]' : 'max-h-[60dvh]'
      }`}
    >
      <button
        onClick={() => setOuverte((o) => !o)}
        aria-expanded={ouverte}
        aria-label={ouverte ? 'Réduire la liste' : 'Ouvrir la liste'}
        className="grid h-7 shrink-0 place-items-center"
      >
        <span className="h-1 w-10 rounded-full bg-trait" />
      </button>

      <div className="flex items-center gap-3 px-4 pb-2">
        <b className="text-3xl leading-none">{reste}</b>
        <span className="text-sm leading-tight text-brume">
          {reste === 0 ? `tous les ${portee.length} sont traités` : `à faire sur ${portee.length}`}
        </span>
        <button
          disabled={!suivant}
          onClick={() => suivant && selectionner(suivant.id)}
          className="ml-auto min-h-11 rounded-[10px] bg-todo px-4 font-bold text-nuit disabled:bg-trait disabled:text-brume"
        >
          Suivant{suivant && <span className="ml-1.5 font-semibold">{dSuivant != null ? formatDistance(dSuivant) : `n° ${suivant.no}`}</span>}
        </button>
      </div>

      <Compteurs parStatut={parStatut} />
      <div className="pt-2">
        <Ruban menages={portee} suivi={suivi} selection={selection} onChoisir={selectionner} />
      </div>

      {ouverte && (
        <div className="mt-2 flex min-h-0 flex-1 flex-col border-t border-trait">
          <div className="flex gap-2 overflow-x-auto px-4 py-2 [scrollbar-width:none]" role="group" aria-label="Segment">
            {[{ cle: '', label: 'Tous' }, ...groupes].map((g) => (
              <button
                key={g.cle}
                aria-pressed={segment === g.cle}
                onClick={() => void definirPref('segment', g.cle).catch(() => {})}
                className={`min-h-11 shrink-0 rounded-[10px] border px-4 ${
                  segment === g.cle ? 'border-craie bg-trait font-semibold' : 'border-trait text-brume'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 px-4 pb-2">
            <input
              type="search"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher"
              aria-label="Rechercher"
              className={`${champ} min-w-0 flex-1`}
              enterKeyHint="search"
            />
            <select
              value={filtre}
              onChange={(e) => setFiltre(e.target.value as Filtre)}
              aria-label="Filtrer par statut"
              className={`${champ} w-28`}
            >
              <option value="tous">Tous</option>
              <option value="reste">Reste à faire</option>
              {STATUTS.map((s) => (
                <option key={s} value={s}>{LIBELLES[s]}</option>
              ))}
            </select>
            <button
              onClick={changerTri}
              disabled={tri === 'num' && !position}
              aria-label={tri === 'num' ? 'Trier par distance' : 'Trier par numéro'}
              title={!position && tri === 'num' ? 'Activez la position pour trier par distance' : undefined}
              className={`${champ} shrink-0 font-semibold disabled:text-brume`}
            >
              {tri === 'dist' ? 'Proche' : 'N°'}
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <Liste lignes={lignes} suivi={suivi} position={position} selection={selection} onChoisir={choisir} />
          </div>
        </div>
      )}
    </section>
  )
}
