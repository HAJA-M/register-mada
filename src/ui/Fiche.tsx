import { useEffect, useRef, useState } from 'react'
import { aUnGps, distanceVers, formatDistance } from '../lib/geo'
import { dansPortee, plusProcheOuvert } from '../lib/liste'
import { useStore } from '../store'
import { LIBELLES, STATUTS, type Statut, type Tokatrano } from '../types'
import { enregistrer, vibrer } from './enregistrer'
import { FOND } from './statuts'

const champ = 'min-h-11 w-full rounded-[10px] border border-trait bg-nuit px-3 text-craie'

/** Note libre : enregistrée peu après la frappe, à la sortie du champ et à la fermeture de la fiche. */
function Note({ id }: { id: string }) {
  const enregistree = useStore((s) => s.suivi[id]?.note ?? '')
  const modifier = useStore((s) => s.modifier)
  const [texte, setTexte] = useState(enregistree)
  const courant = useRef({ texte, enregistree })
  courant.current = { texte, enregistree }

  const sauver = () => {
    const { texte: t, enregistree: e } = courant.current
    if (t !== e) void enregistrer(() => modifier(id, { note: t }))
  }

  useEffect(() => {
    const t = setTimeout(sauver, 600)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texte])
  useEffect(() => sauver, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <label className="block">
      <span className="mb-1 block text-sm text-brume">Note</span>
      <textarea
        value={texte}
        onChange={(e) => setTexte(e.target.value)}
        onBlur={sauver}
        rows={3}
        className={`${champ} py-2`}
      />
    </label>
  )
}

function Faits({ m }: { m: Tokatrano }) {
  const lignes: [string, string][] = [
    ['Segment', `${m.grappe} · ${m.segment}`],
    ['Fokontany', m.fokontany.replace('_', ' · ')],
    ['Commune', [m.faritra, m.distrika, m.kaominina].filter(Boolean).join(' · ')],
    ['Logement', `n° ${m.logement}, ménage ${m.noDansLogement} sur ${m.nbMenagesLogement}`],
    ['Membres', m.membres],
    ['Au dénombrement', m.pa === 'P' ? 'Présent' : m.pa === 'A' ? 'Absent' : ''],
    ['Recensement', m.tratra],
    [
      'GPS',
      aUnGps(m)
        ? `${m.lat.toFixed(6)}, ${m.lon.toFixed(6)}${m.precision != null ? ` (±${Math.round(m.precision)} m)` : ''}`
        : 'Aucune coordonnée',
    ],
    ['Altitude', m.altitude != null ? `${Math.round(m.altitude)} m` : ''],
    ['Remarque', m.remarques],
  ]
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
      {lignes
        .filter(([, v]) => v)
        .map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-brume">{k}</dt>
            <dd className="min-w-0 break-words">{v}</dd>
          </div>
        ))}
    </dl>
  )
}

export function Fiche({ id }: { id: string }) {
  const m = useStore((s) => s.menages.find((x) => x.id === id))
  const suivi = useStore((s) => s.suivi[id])
  const position = useStore((s) => s.position)
  const menages = useStore((s) => s.menages)
  const toutSuivi = useStore((s) => s.suivi)
  const segment = useStore((s) => s.prefs.segment)
  const fokontany = useStore((s) => s.prefs.fokontany)
  const changerStatut = useStore((s) => s.changerStatut)
  const modifier = useStore((s) => s.modifier)
  const selectionner = useStore((s) => s.selectionner)
  const [etendue, setEtendue] = useState(false)

  useEffect(() => {
    const fermer = (e: KeyboardEvent) => e.key === 'Escape' && selectionner(null)
    addEventListener('keydown', fermer)
    return () => removeEventListener('keydown', fermer)
  }, [selectionner])

  if (!m) return null
  const statut: Statut = suivi?.statut ?? 'todo'
  const d = distanceVers(position, m)
  const suivant = plusProcheOuvert(dansPortee(menages, { fokontany, segment }), toutSuivi, position, id)
  const dSuivant = suivant ? distanceVers(position, suivant) : null

  const choisirStatut = async (s: Statut) => {
    if (s === statut) return
    if (await enregistrer(() => changerStatut(id, s))) vibrer()
  }

  return (
    <section
      aria-label={`Fiche ${m.no}`}
      className={`anim-monter absolute inset-x-0 bottom-0 flex flex-col rounded-t-[14px] border-t border-trait bg-ardoise pb-[env(safe-area-inset-bottom)] ${
        etendue ? 'h-[88dvh]' : 'h-[52dvh]'
      }`}
    >
      <button
        onClick={() => setEtendue((e) => !e)}
        aria-expanded={etendue}
        aria-label={etendue ? 'Réduire la fiche' : 'Agrandir la fiche'}
        className="grid h-7 shrink-0 place-items-center"
      >
        <span className="h-1 w-10 rounded-full bg-trait" />
      </button>

      <div className="flex items-start gap-2 px-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-brume">{m.id}</p>
          <h2 className="text-xl font-bold leading-tight">{m.chef || m.surnom || 'Fiche sans nom'}</h2>
          <p className="text-sm text-brume">
            {[m.surnom && `« ${m.surnom} »`, m.adresse].filter(Boolean).join(' · ')}
          </p>
        </div>
        <button
          onClick={() => selectionner(null)}
          aria-label="Fermer la fiche"
          className="grid size-11 shrink-0 place-items-center rounded-[10px] border border-trait"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 pb-4 pt-3">
        {m.marika && (
          <p className="rounded-[10px] bg-nuit p-3">
            <span className="block text-xs text-brume">Repère</span>
            {m.marika}
          </p>
        )}

        <div className="flex flex-wrap gap-2" role="group" aria-label="Statut">
          {STATUTS.map((s) => (
            <button
              key={s}
              aria-pressed={statut === s}
              onClick={() => void choisirStatut(s)}
              className={`flex min-h-11 flex-1 basis-[30%] items-center justify-center gap-2 rounded-[10px] border px-2 ${
                statut === s ? `${FOND[s]} border-transparent font-bold text-nuit` : 'border-trait'
              }`}
            >
              {statut !== s && <i className={`size-2.5 rounded-full ${FOND[s]}`} />}
              {LIBELLES[s]}
            </button>
          ))}
        </div>

        <div className="flex items-end gap-3">
          <label className="block flex-1">
            <span className="mb-1 block text-sm text-brume">Date de visite</span>
            <input
              type="date"
              value={suivi?.date ?? ''}
              onChange={(e) => void enregistrer(() => modifier(id, { date: e.target.value }))}
              className={champ}
            />
          </label>
          <div className="flex-1 pb-2 text-right text-sm">
            <span className="block text-brume">Distance</span>
            <b>{d != null ? formatDistance(d) : position ? '—' : 'position inconnue'}</b>
          </div>
        </div>

        <Note id={id} />

        {aUnGps(m) && (
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${m.lat},${m.lon}`}
            target="_blank"
            rel="noopener noreferrer"
            className="grid min-h-11 place-items-center rounded-[10px] border border-trait font-semibold"
          >
            Itinéraire (réseau requis)
          </a>
        )}

        <Faits m={m} />
      </div>

      <div className="shrink-0 border-t border-trait px-4 py-2">
        <button
          disabled={!suivant}
          onClick={() => suivant && selectionner(suivant.id)}
          className="min-h-12 w-full rounded-[10px] bg-todo px-4 text-lg font-bold text-nuit disabled:bg-trait disabled:text-brume"
        >
          {suivant ? (
            <>
              Ménage suivant · n° {suivant.no}
              {dSuivant != null && <span className="ml-2 text-base font-semibold">{formatDistance(dSuivant)}</span>}
            </>
          ) : (
            'Aucun autre ménage à faire'
          )}
        </button>
      </div>
    </section>
  )
}
