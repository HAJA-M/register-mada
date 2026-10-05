import { useState } from 'react'
import type { Verification } from '../lib/miseAJour'
import { forcerRechargement, useMiseAJour, verifierMiseAJour } from '../pwa'
import { useStore } from '../store'
import { Modal } from './Modal'
import { ReglagesAffichage } from './ReglagesAffichage'
import { ReglagesDonnees } from './ReglagesDonnees'

const date = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' })
const heure = new Intl.DateTimeFormat('fr-FR', { timeStyle: 'short' })

const MESSAGES: Record<Verification, { texte: string; alerte: boolean }> = {
  'a-jour': { texte: "Vous avez la dernière version de l'application.", alerte: false },
  disponible: { texte: 'Une nouvelle version est prête à être installée.', alerte: false },
  'hors-ligne': { texte: 'Pas de réseau : connectez-vous à internet pour vérifier.', alerte: true },
  indisponible: {
    texte: import.meta.env.DEV
      ? 'Mises à jour désactivées en mode développement.'
      : "Les mises à jour ne sont pas disponibles dans ce navigateur. Ouvrez l'application depuis son adresse https.",
    alerte: true,
  },
  erreur: { texte: 'Vérification impossible pour le moment. Réessayez dans un instant.', alerte: true },
}

export function Reglages() {
  const ouvert = useStore((s) => s.panneau === 'reglages')
  return ouvert ? <Panneau /> : null
}

function Panneau() {
  const { disponible, appliquer, derniere } = useMiseAJour()
  const [etat, setEtat] = useState<'repos' | 'en-cours' | Verification>('repos')
  const [confirmer, setConfirmer] = useState(false)
  const [horsLigne, setHorsLigne] = useState(false)

  const verifier = async () => {
    setEtat('en-cours')
    setEtat(await verifierMiseAJour())
  }

  const forcer = async () => {
    if (!confirmer) {
      setConfirmer(true)
      setTimeout(() => setConfirmer(false), 4000)
      return
    }
    setConfirmer(false)
    setHorsLigne((await forcerRechargement()) === 'hors-ligne')
  }

  // « disponible » peut aussi venir du bandeau, sans que l'utilisateur ait cliqué ici.
  const prete = disponible || etat === 'disponible'
  const message = etat !== 'repos' && etat !== 'en-cours' ? MESSAGES[etat] : null

  return (
    <Modal titre="Réglages" fermable={etat !== 'en-cours'}>
      <section aria-labelledby="titre-app" className="space-y-3">
        <h3 id="titre-app" className="font-semibold">Application</h3>
        <p className="text-sm text-brume">
          Version <b className="text-craie">{__APP_VERSION__}</b> · {__APP_COMMIT__}
          <br />
          Construite le {date.format(new Date(__APP_BUILD__))}
        </p>

        {prete ? (
          <button onClick={appliquer} className="min-h-12 w-full rounded-[10px] bg-encours px-4 text-lg font-bold text-nuit">
            Installer la mise à jour
          </button>
        ) : (
          <button
            onClick={() => void verifier()}
            disabled={etat === 'en-cours'}
            className="min-h-12 w-full rounded-[10px] bg-todo px-4 text-lg font-bold text-nuit disabled:bg-trait disabled:text-brume"
          >
            {etat === 'en-cours' ? 'Vérification…' : 'Vérifier les mises à jour'}
          </button>
        )}

        <p role="status" aria-live="polite" className={`text-sm ${message?.alerte ? 'text-todo' : 'text-craie'}`}>
          {message?.texte}
          {message && !message.alerte && derniere && (
            <span className="text-brume"> Vérifié à {heure.format(derniere)}.</span>
          )}
        </p>
        <p className="text-sm text-brume">
          L'installation recharge l'application en quelques secondes. Vos ménages, vos notes et la carte téléchargée sont
          conservés.
        </p>

        <details className="rounded-[10px] border border-trait">
          <summary className="flex min-h-11 items-center px-3 text-sm font-semibold">L'application semble bloquée ?</summary>
          <div className="space-y-3 px-3 pb-3">
            <p className="text-sm text-brume">
              Si une version ancienne persiste, vous pouvez forcer un rechargement complet depuis internet. Vos données et la
              carte téléchargée ne sont pas effacées. Le réseau est indispensable.
            </p>
            <button
              onClick={() => void forcer()}
              className={`min-h-11 w-full rounded-[10px] border px-4 font-semibold ${
                confirmer ? 'border-refus bg-refus text-nuit' : 'border-trait'
              }`}
            >
              {confirmer ? 'Confirmer le rechargement complet' : 'Forcer le rechargement complet'}
            </button>
            {horsLigne && (
              <p role="alert" className="text-sm text-todo">
                Pas de réseau : rien n'a été modifié. Réessayez une fois connecté.
              </p>
            )}
          </div>
        </details>
      </section>
      <ReglagesDonnees />
      <ReglagesAffichage />
    </Modal>
  )
}
