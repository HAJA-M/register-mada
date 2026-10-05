import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { emprise } from '../lib/geo'
import { dansSegment, segments } from '../lib/liste'
import { telecharger, type Progres, type Resultat } from '../lib/telechargement'
import { CACHE_TUILES, listeTuiles, megaoctets, OCTETS_PAR_TUILE, unir } from '../lib/tuiles'
import { useEnLigne } from '../lib/useEnLigne'
import { useStore } from '../store'

/** Marge autour des ménages, en degrés (≈ 450 m) : on voit un peu autour de la maison. */
const MARGE = 0.004

const nomFokontany = (f: string) => {
  const n = f.split('_')[0]!.toLowerCase()
  return n.charAt(0).toUpperCase() + n.slice(1)
}

const disponible = () => typeof caches !== 'undefined'

export function HorsLigne() {
  const ouvert = useStore((s) => s.panneau === 'horsligne')
  if (!ouvert) return null
  return <Panneau />
}

function Panneau() {
  const menages = useStore((s) => s.menages)
  const fond = useStore((s) => s.prefs.fond)
  const fermer = useStore((s) => s.ouvrirPanneau)
  const enLigne = useEnLigne()

  const [cachees, setCachees] = useState<Set<string>>(new Set())
  const [progres, setProgres] = useState<Progres | null>(null)
  const [bilan, setBilan] = useState<Resultat | null>(null)
  const [stockage, setStockage] = useState<{ usage: number; quota: number } | null>(null)
  const [confirmerVidage, setConfirmerVidage] = useState(false)
  const arret = useRef<AbortController | null>(null)
  const enCours = progres != null

  const groupes = useMemo(
    () =>
      segments(menages).map((g) => {
        const fiches = dansSegment(menages, g.cle)
        const e = emprise(fiches, MARGE)
        return { ...g, nb: fiches.length, urls: e ? listeTuiles(e, fond) : [] }
      }),
    [menages, fond],
  )
  const toutes = useMemo(() => unir(...groupes.map((g) => g.urls)), [groupes])

  const rafraichir = useCallback(async () => {
    if (disponible()) {
      const cache = await caches.open(CACHE_TUILES)
      setCachees(new Set((await cache.keys()).map((r) => r.url)))
    }
    const est = await navigator.storage?.estimate?.()
    if (est?.usage != null && est.quota != null) setStockage({ usage: est.usage, quota: est.quota })
  }, [])

  useEffect(() => {
    void rafraichir()
  }, [rafraichir])

  useEffect(() => {
    const echap = (e: KeyboardEvent) => e.key === 'Escape' && !arret.current && fermer(null)
    addEventListener('keydown', echap)
    return () => removeEventListener('keydown', echap)
  }, [fermer])

  const lancer = async (urls: string[]) => {
    if (!disponible() || enCours) return
    setBilan(null)
    setProgres({ fait: 0, total: urls.length, echecs: 0 })
    arret.current = new AbortController()
    // Demande au navigateur de ne pas effacer ces données quand le téléphone manque de place.
    void navigator.storage?.persist?.()
    try {
      const cache = await caches.open(CACHE_TUILES)
      setBilan(await telecharger(urls, cache, { signal: arret.current.signal, onProgres: setProgres }))
    } finally {
      arret.current = null
      setProgres(null)
      await rafraichir()
    }
  }

  const vider = async () => {
    if (!confirmerVidage) {
      setConfirmerVidage(true)
      setTimeout(() => setConfirmerVidage(false), 4000)
      return
    }
    setConfirmerVidage(false)
    await caches.delete(CACHE_TUILES)
    setBilan(null)
    await rafraichir()
  }

  const ligneTotal = (urls: string[]) => {
    const n = urls.filter((u) => cachees.has(u)).length
    return { n, complet: urls.length > 0 && n === urls.length }
  }
  const total = ligneTotal(toutes)
  const taille = (nb: number) => megaoctets(nb * OCTETS_PAR_TUILE[fond])

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end">
      <button
        aria-label="Fermer"
        onClick={() => !enCours && fermer(null)}
        className="scrim absolute inset-0 cursor-default"
        tabIndex={-1}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Carte hors ligne"
        className="anim-monter relative flex max-h-[88dvh] flex-col rounded-t-[14px] border-t border-trait bg-ardoise pb-[env(safe-area-inset-bottom)]"
      >
        <div className="flex items-center gap-2 px-4 pb-2 pt-4">
          <h2 className="flex-1 text-xl font-bold">Carte hors ligne</h2>
          <button
            onClick={() => fermer(null)}
            disabled={enCours}
            aria-label="Fermer"
            className="grid size-11 place-items-center rounded-[10px] border border-trait disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 pb-4">
          <p className="text-sm text-brume">
            Fond actuel : <b className="text-craie">{fond === 'sat' ? 'satellite' : 'plan'}</b>. Téléchargez en wifi, avant de
            partir : la carte s'affichera ensuite sans réseau. Le satellite et le plan sont deux jeux d'images distincts.
          </p>

          {!disponible() && (
            <p role="alert" className="rounded-[10px] border border-refus p-3 text-sm">
              Ce navigateur ne permet pas de garder la carte hors ligne.
            </p>
          )}
          {!enLigne && (
            <p className="rounded-[10px] border border-trait bg-nuit p-3 text-sm">
              Pas de réseau : connectez-vous à internet pour télécharger.
            </p>
          )}

          <ul className="divide-y divide-trait rounded-[10px] border border-trait">
            {groupes.map((g) => {
              const { n, complet } = ligneTotal(g.urls)
              return (
                <li key={g.cle} className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {g.label} <span className="font-normal text-brume">· {g.nb} ménages</span>
                    </p>
                    <p className="truncate text-xs text-brume">{nomFokontany(g.fokontany)}</p>
                    <p className="text-xs text-brume">
                      {g.urls.length} images · ≈ {taille(g.urls.length)}
                    </p>
                  </div>
                  {complet ? (
                    <span className="rounded-full bg-fait px-3 py-1 text-sm font-semibold text-nuit">Disponible</span>
                  ) : (
                    <button
                      onClick={() => void lancer(g.urls)}
                      disabled={!enLigne || enCours || !disponible()}
                      className="min-h-11 shrink-0 rounded-[10px] border border-craie px-3 font-semibold disabled:border-trait disabled:text-brume"
                    >
                      {n / g.urls.length >= 0.1 ? `Compléter · ${Math.round((n / g.urls.length) * 100)} %` : 'Télécharger'}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>

          <button
            onClick={() => void lancer(toutes)}
            disabled={!enLigne || enCours || !disponible() || total.complet}
            className="min-h-12 w-full rounded-[10px] bg-todo px-4 text-lg font-bold text-nuit disabled:bg-trait disabled:text-brume"
          >
            {total.complet ? (
              'Tout est disponible'
            ) : (
              <>
                Tout télécharger
                <span className="block text-sm font-semibold">
                  {toutes.length} images · ≈ {taille(toutes.length)}
                </span>
              </>
            )}
          </button>

          {progres && (
            <div>
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={progres.total}
                aria-valuenow={progres.fait}
                className="h-3 overflow-hidden rounded-full bg-nuit"
              >
                <div
                  className="h-full bg-fait transition-[width]"
                  style={{ width: `${progres.total ? (progres.fait / progres.total) * 100 : 0}%` }}
                />
              </div>
              <div className="mt-2 flex items-center gap-3">
                <p className="flex-1 text-sm" aria-live="polite">
                  {progres.fait} sur {progres.total} images
                  {progres.echecs > 0 && <span className="text-brume"> · {progres.echecs} en échec</span>}
                </p>
                <button
                  onClick={() => arret.current?.abort()}
                  className="min-h-11 rounded-[10px] border border-trait px-4 font-semibold"
                >
                  Interrompre
                </button>
              </div>
            </div>
          )}

          {bilan && !progres && <Bilan r={bilan} />}

          <div className="flex items-center gap-3 border-t border-trait pt-3 text-sm text-brume">
            <p className="flex-1">
              {stockage
                ? `Stockage utilisé par l'application : ${megaoctets(stockage.usage)} sur ${megaoctets(stockage.quota)}.`
                : 'Stockage : information indisponible.'}
            </p>
            <button
              onClick={() => void vider()}
              disabled={enCours || cachees.size === 0}
              className={`min-h-11 shrink-0 rounded-[10px] border px-3 font-semibold disabled:opacity-40 ${
                confirmerVidage ? 'border-refus bg-refus text-nuit' : 'border-trait text-craie'
              }`}
            >
              {confirmerVidage ? 'Confirmer le vidage' : 'Vider la carte'}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

function Bilan({ r }: { r: Resultat }) {
  const { texte, alerte } = r.stockagePlein
    ? { texte: "Mémoire du téléphone pleine : le téléchargement s'est arrêté. Libérez de la place ou videz la carte.", alerte: true }
    : r.annule
      ? { texte: 'Téléchargement interrompu. Ce qui est déjà enregistré reste disponible.', alerte: false }
      : r.echecs > 0
        ? { texte: `${r.echecs} images manquantes. Relancez pour compléter.`, alerte: true }
        : { texte: `${r.enregistrees + r.dejaLa} images disponibles hors ligne.`, alerte: false }
  return (
    <p role={alerte ? 'alert' : 'status'} className={`rounded-[10px] border p-3 text-sm ${alerte ? 'border-refus' : 'border-fait'}`}>
      {texte}
    </p>
  )
}
