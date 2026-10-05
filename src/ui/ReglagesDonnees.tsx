import { useRef, useState } from 'react'
import { QuotaError } from '../db'
import { nomFichier, versCsv, versJson } from '../lib/export'
import { useStore, type RapportImport } from '../store'
import { enregistrerFichier, TAILLE_MAX_IMPORT } from './fichiers'
import { enregistrer } from './enregistrer'

const heure = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' })

const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`

function resume(r: RapportImport): string {
  const morceaux = [
    r.misesAJour
      ? `${pluriel(r.misesAJour, 'fiche mise à jour', 'fiches mises à jour')}`
      : 'Aucune fiche à mettre à jour',
  ]
  if (r.inchangees) morceaux.push(`${r.inchangees} déjà à jour ou plus récentes ici`)
  if (r.inconnues) morceaux.push(`${pluriel(r.inconnues, 'sans ménage correspondant (conservée)', 'sans ménage correspondant (conservées)')}`)
  if (r.ignorees) morceaux.push(`${pluriel(r.ignorees, 'entrée illisible ignorée', 'entrées illisibles ignorées')}`)
  return `${morceaux.join(' · ')}.`
}

export function ReglagesDonnees() {
  const menages = useStore((s) => s.menages)
  const suivi = useStore((s) => s.suivi)
  const sauvegarde = useStore((s) => s.prefs.sauvegarde)
  const restauration = useStore((s) => s.restauration)
  const importerFichier = useStore((s) => s.importerFichier)
  const annulerRestauration = useStore((s) => s.annulerRestauration)
  const toutEffacer = useStore((s) => s.toutEffacer)
  const marquerSauvegarde = useStore((s) => s.marquerSauvegarde)

  const [message, setMessage] = useState<{ texte: string; alerte: boolean } | null>(null)
  const [confirmer, setConfirmer] = useState(false)
  const champFichier = useRef<HTMLInputElement>(null)
  const nb = Object.keys(suivi).length

  const exporterJson = async () => {
    const fiches = Object.values(suivi).sort((a, b) => a.id.localeCompare(b.id))
    enregistrerFichier(nomFichier('progression', 'json'), versJson(fiches), 'application/json')
    await enregistrer(marquerSauvegarde)
    setMessage({ texte: 'Sauvegarde téléchargée. Gardez-la en lieu sûr (messagerie, cloud, ordinateur).', alerte: false })
  }

  const exporterCsv = () => {
    enregistrerFichier(nomFichier('suivi', 'csv'), versCsv(menages, suivi), 'text/csv;charset=utf-8')
    setMessage({ texte: 'Fichier pour tableur téléchargé (séparateur « ; », accents conservés).', alerte: false })
  }

  const importer = async (fichier: File) => {
    if (fichier.size > TAILLE_MAX_IMPORT) {
      return setMessage({ texte: "Ce fichier est trop gros pour être une sauvegarde de suivi.", alerte: true })
    }
    let donnees: unknown
    try {
      donnees = JSON.parse(await fichier.text())
    } catch {
      return setMessage({ texte: "Fichier illisible : ce n'est pas une sauvegarde au format JSON.", alerte: true })
    }
    try {
      setMessage({ texte: resume(await importerFichier(donnees)), alerte: false })
    } catch (e) {
      setMessage({
        texte:
          e instanceof QuotaError
            ? "Mémoire du téléphone pleine : l'import n'a pas été enregistré."
            : 'Format non reconnu : ce fichier ne contient pas de suivi de ménages.',
        alerte: true,
      })
    }
  }

  const annuler = async () => {
    try {
      const { rendues, conservees } = await annulerRestauration()
      setMessage({
        texte:
          `${pluriel(rendues, 'fiche rétablie', 'fiches rétablies')}` +
          (conservees ? `, ${pluriel(conservees, 'conservée', 'conservées')} car modifiée${conservees > 1 ? 's' : ''} depuis` : '') +
          '.',
        alerte: false,
      })
    } catch {
      setMessage({ texte: "L'annulation n'a pas pu être enregistrée. Réessayez.", alerte: true })
    }
  }

  const effacer = async () => {
    if (!confirmer) {
      setConfirmer(true)
      setTimeout(() => setConfirmer(false), 4000)
      return
    }
    setConfirmer(false)
    try {
      await toutEffacer()
      setMessage({ texte: 'Toute la progression a été effacée. Vous pouvez encore annuler tant que l’application reste ouverte.', alerte: false })
    } catch {
      setMessage({ texte: "L'effacement a échoué. Rien n'a été modifié.", alerte: true })
    }
  }

  const bouton = 'min-h-12 w-full rounded-[10px] border px-4 font-semibold'

  return (
    <section aria-labelledby="titre-donnees" className="space-y-3">
      <h3 id="titre-donnees" className="font-semibold">Données</h3>
      <p className="text-sm text-brume">
        {nb === 0 ? 'Aucun statut ni note saisi pour le moment.' : `${pluriel(nb, 'ménage a', 'ménages ont')} un statut ou une note.`}{' '}
        {sauvegarde
          ? `Dernière sauvegarde : ${heure.format(new Date(sauvegarde))}.`
          : nb > 0
            ? 'Aucune sauvegarde faite : exportez régulièrement.'
            : ''}
      </p>

      <button onClick={() => void exporterJson()} className={`${bouton} border-transparent bg-todo text-lg font-bold text-nuit`}>
        Sauvegarder la progression (JSON)
      </button>
      <button onClick={exporterCsv} className={`${bouton} border-trait`}>
        Exporter pour un tableur (CSV)
      </button>

      <input
        ref={champFichier}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = '' // permet de choisir deux fois le même fichier
          if (f) void importer(f)
        }}
      />
      <button onClick={() => champFichier.current?.click()} className={`${bouton} border-trait`}>
        Importer une sauvegarde (JSON)
      </button>
      <p className="text-sm text-brume">
        L'import ne remplace jamais une fiche plus récente que celle du fichier : pour chaque ménage, la modification la plus
        récente gagne. Il peut s'annuler.
      </p>

      {message && (
        <p role={message.alerte ? 'alert' : 'status'} className={`rounded-[10px] border p-3 text-sm ${message.alerte ? 'border-refus' : 'border-fait'}`}>
          {message.texte}
        </p>
      )}

      {restauration && (
        <button onClick={() => void annuler()} className={`${bouton} border-craie`}>
          Annuler : {restauration.libelle.toLowerCase()}
        </button>
      )}

      <button
        onClick={() => void effacer()}
        disabled={nb === 0}
        className={`${bouton} disabled:opacity-40 ${confirmer ? 'border-refus bg-refus text-nuit' : 'border-trait text-refus'}`}
      >
        {confirmer ? 'Confirmer : tout effacer' : 'Effacer toute la progression'}
      </button>
    </section>
  )
}
