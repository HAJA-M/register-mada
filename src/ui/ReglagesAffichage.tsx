import { useStore } from '../store'
import { enregistrer } from './enregistrer'
import { Interrupteur } from './Interrupteur'

export function ReglagesAffichage() {
  const { pleinSoleil, masquerFaits, fond } = useStore((s) => s.prefs)
  const definirPref = useStore((s) => s.definirPref)

  return (
    <section aria-labelledby="titre-affichage" className="space-y-3">
      <h3 id="titre-affichage" className="font-semibold">Affichage</h3>
      <Interrupteur
        label="Mode plein soleil"
        aide="Contrastes renforcés, aucune transparence."
        actif={pleinSoleil}
        onChange={(v) => void enregistrer(() => definirPref('pleinSoleil', v))}
      />
      <Interrupteur
        label="Masquer les ménages terminés"
        aide="Sur la carte : ne reste que le travail à faire."
        actif={masquerFaits}
        onChange={(v) => void enregistrer(() => definirPref('masquerFaits', v))}
      />
      <div role="group" aria-label="Fond de carte" className="grid grid-cols-2 gap-2">
        {(['sat', 'osm'] as const).map((f) => (
          <button
            key={f}
            aria-pressed={fond === f}
            onClick={() => void enregistrer(() => definirPref('fond', f))}
            className={`min-h-11 rounded-[10px] border px-3 font-semibold ${
              fond === f ? 'border-craie bg-trait' : 'border-trait text-brume'
            }`}
          >
            {f === 'sat' ? 'Satellite' : 'Plan'}
          </button>
        ))}
      </div>
    </section>
  )
}
