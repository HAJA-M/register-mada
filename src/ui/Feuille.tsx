import { useEffect, useMemo, useRef, useState } from 'react'
import {
  compter, dansPortee, filtrer, fokontanys, nomFokontany, plusProcheOuvert, segments, statutDe, trierParDistance,
  type Filtre,
} from '../lib/liste'
import { distanceVers, formatDistance } from '../lib/geo'
import { useStore } from '../store'
import { LIBELLES, STATUTS } from '../types'
import { Compteurs } from './Compteurs'
import { Liste } from './Liste'
import { enregistrer, vibrer } from './enregistrer'
import { Ruban } from './Ruban'

const champ = 'min-h-11 rounded-[10px] border border-trait bg-nuit px-3 text-craie'

/** Puce de périmètre : libellé + nombre de ménages restants, « fini » quand il n'y en a plus. */
function Puce({
  actif, label, reste, termine, onClick,
}: {
  actif: boolean
  label: string
  reste: number
  termine: boolean
  onClick: () => void
}) {
  return (
    <button
      aria-pressed={actif}
      onClick={onClick}
      className={`flex min-h-11 shrink-0 items-center gap-2 rounded-[10px] border px-3 ${
        actif ? 'border-craie bg-trait font-semibold' : 'border-trait text-brume'
      }`}
    >
      {label}
      <span
        className={`rounded-full px-2 text-xs font-semibold tabular-nums ${
          termine ? 'bg-fait text-nuit' : 'bg-nuit text-craie'
        }`}
      >
        {termine ? 'fini' : reste}
      </span>
    </button>
  )
}

/** Rangée de puces défilante ; la puce active reste visible quand le périmètre change. */
function RangeePuces({ label, children }: { label: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.querySelector('[aria-pressed=true]')?.scrollIntoView({ inline: 'center', block: 'nearest' })
  })
  return (
    <div
      ref={ref}
      className="flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none]"
      role="group"
      aria-label={label}
    >
      {children}
    </div>
  )
}

export function Feuille({ cachee }: { cachee: boolean }) {
  const menages = useStore((s) => s.menages)
  const suivi = useStore((s) => s.suivi)
  const position = useStore((s) => s.position)
  const selection = useStore((s) => s.selection)
  const { fokontany, segment, tri } = useStore((s) => s.prefs)
  const selectionner = useStore((s) => s.selectionner)
  const definirPref = useStore((s) => s.definirPref)
  const definirPrefs = useStore((s) => s.definirPrefs)
  const changerStatut = useStore((s) => s.changerStatut)

  const [ouverte, setOuverte] = useState(false)
  const [recherche, setRecherche] = useState('')
  const [filtre, setFiltre] = useState<Filtre>('tous')

  const portee = useMemo(() => dansPortee(menages, { fokontany, segment }), [menages, fokontany, segment])
  const { parStatut, reste } = useMemo(() => compter(portee, suivi), [portee, suivi])
  const parFokontany = useMemo(
    () => [
      { cle: '', label: 'Tous', reste: compter(menages, suivi).reste },
      ...fokontanys(menages).map((f) => ({
        ...f,
        reste: compter(dansPortee(menages, { fokontany: f.cle, segment: '' }), suivi).reste,
      })),
    ],
    [menages, suivi],
  )
  // Les segments ne s'affichent que s'il y a un choix à faire dans le fokontany retenu.
  const parSegment = useMemo(() => {
    if (!fokontany) return []
    const dedans = dansPortee(menages, { fokontany, segment: '' })
    const liste = segments(dedans)
    if (liste.length < 2) return []
    return [
      { cle: '', label: `Tout ${nomFokontany(fokontany)}`, reste: compter(dedans, suivi).reste },
      ...liste.map((g) => ({ ...g, reste: compter(dansPortee(dedans, { fokontany: '', segment: g.cle }), suivi).reste })),
    ]
  }, [menages, suivi, fokontany])
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
    void enregistrer(() => definirPref('tri', tri === 'num' ? 'dist' : 'num'))
  }
  const basculerFait = async (id: string) => {
    const fait = statutDe(suivi, id) === 'fait'
    if (await enregistrer(() => changerStatut(id, fait ? 'todo' : 'fait'))) vibrer()
  }
  const dSuivant = suivant ? distanceVers(position, suivant) : null

  return (
    <section
      aria-label="Ménages"
      hidden={cachee}
      className={`absolute inset-x-0 bottom-0 flex flex-col rounded-t-[14px] border-t border-trait bg-ardoise pb-[env(safe-area-inset-bottom)] ${
        ouverte ? 'h-[82dvh]' : 'max-h-[60dvh]'
      }`}
    >
      <button
        onClick={() => setOuverte((o) => !o)}
        aria-expanded={ouverte}
        aria-label={ouverte ? 'Réduire la liste' : 'Ouvrir la liste'}
        className="grid h-8 shrink-0 place-items-center"
      >
        <span className="h-1 w-10 rounded-full bg-trait" />
      </button>

      <div className="flex items-center gap-3 px-4 pb-2">
        <b className="text-4xl font-bold leading-none">{reste}</b>
        <span className="text-sm leading-tight text-brume">
          {reste === 0 ? <>Tout est traité<br />({portee.length} ménages)</> : <>à faire<br />sur {portee.length}</>}
        </span>
        <button
          disabled={!suivant}
          onClick={() => suivant && selectionner(suivant.id)}
          className="ml-auto min-h-12 rounded-[10px] bg-todo px-5 text-lg font-bold text-nuit disabled:bg-trait disabled:text-brume"
        >
          Suivant
          {suivant && (
            <span className="ml-2 text-base font-semibold">
              {dSuivant != null ? formatDistance(dSuivant) : `n° ${suivant.no}`}
            </span>
          )}
        </button>
      </div>

      <RangeePuces label="Fokontany">
        {parFokontany.map((f) => (
          <Puce
            key={f.cle}
            actif={fokontany === f.cle}
            label={f.label}
            reste={f.reste}
            termine={f.reste === 0 && f.cle !== ''}
            onClick={() => void enregistrer(() => definirPrefs({ fokontany: f.cle, segment: '' }))}
          />
        ))}
      </RangeePuces>
      {parSegment.length > 0 && (
        <RangeePuces label="Segment">
          {parSegment.map((g) => (
            <Puce
              key={g.cle}
              actif={segment === g.cle}
              label={g.label}
              reste={g.reste}
              termine={g.reste === 0 && g.cle !== ''}
              onClick={() => void enregistrer(() => definirPref('segment', g.cle))}
            />
          ))}
        </RangeePuces>
      )}

      {!ouverte && (
        <>
          <Compteurs parStatut={parStatut} />
          <div className="pb-2 pt-2">
            <Ruban menages={portee} suivi={suivi} selection={selection} onChoisir={selectionner} />
          </div>
        </>
      )}

      {ouverte && (
        <div className="flex min-h-0 flex-1 flex-col border-t border-trait pt-2">
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
            <Liste lignes={lignes} suivi={suivi} position={position} selection={selection} onChoisir={choisir} onBasculerFait={(id) => void basculerFait(id)} />
          </div>
        </div>
      )}
    </section>
  )
}
