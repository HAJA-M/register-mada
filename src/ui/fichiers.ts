/** Déclenche le téléchargement d'un fichier généré dans le navigateur (aucun serveur). */
export function enregistrerFichier(nom: string, contenu: string, type: string) {
  const url = URL.createObjectURL(new Blob([contenu], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = nom
  document.body.append(a)
  a.click()
  a.remove()
  // Pas tout de suite : certains navigateurs mobiles lisent l'adresse après le clic.
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

/** Au-delà, ce n'est pas une sauvegarde de suivi : on refuse avant de lire le fichier en mémoire. */
export const TAILLE_MAX_IMPORT = 10 * 1024 * 1024
