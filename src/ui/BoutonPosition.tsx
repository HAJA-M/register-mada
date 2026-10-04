import { useGps } from '../lib/useGps'

export function BoutonPosition() {
  const { etat, erreur, basculer } = useGps()
  const actif = etat !== 'off'
  return (
    <div className="absolute right-3 top-[calc(env(safe-area-inset-top)+12px)] flex flex-col items-end gap-2">
      <button
        onClick={basculer}
        aria-pressed={actif}
        aria-label={actif ? 'Couper la position' : 'Afficher ma position'}
        className={`grid size-11 place-items-center rounded-[10px] border border-trait ${
          actif ? 'bg-encours text-nuit' : 'bg-ardoise text-craie'
        } ${etat === 'attente' ? 'animate-pulse' : ''}`}
      >
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
        </svg>
      </button>
      {erreur && (
        <p role="alert" className="max-w-56 rounded-[10px] border border-trait bg-ardoise px-3 py-2 text-sm">
          {erreur}
        </p>
      )}
    </div>
  )
}
