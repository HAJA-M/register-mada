import { LIBELLES, type Suivi, type Tokatrano } from '../types'

/** Contenu du fichier de sauvegarde. `lireImport` relit ce format, et celui du prototype. */
export const versJson = (suivi: Suivi[], maintenant = new Date()) =>
  JSON.stringify({ app: 'fanisana', version: 1, exporte: maintenant.toISOString(), suivi }, null, 1)

// Un tableur interprète « =… », « +… », « -… », « @… » comme une formule : on neutralise les textes saisis.
const FORMULE = /^[=+\-@\t\r]/

function cellule(valeur: string | number | null | undefined, texte = true): string {
  let s = String(valeur ?? '')
  if (texte && FORMULE.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}

const ENTETE = [
  'Kaody_tokatrano', 'Grappe', 'Segment', 'Fokontany', 'N_tokatrano', 'Chef_de_menage', 'Surnom', 'Membres',
  'Adresse', 'Latitude', 'Longitude', 'Statut', 'Date_visite', 'Note', 'Derniere_maj',
]

/** CSV pour tableur français : séparateur « ; », UTF-8 avec BOM (accents), fins de ligne Windows. Un ménage par ligne. */
export function versCsv(menages: Tokatrano[], suivi: Record<string, Suivi>): string {
  const lignes = [ENTETE.join(';')]
  for (const m of menages) {
    const e = suivi[m.id]
    lignes.push(
      [
        cellule(m.id), cellule(m.grappe), cellule(m.segment), cellule(m.fokontany), cellule(m.no),
        cellule(m.chef), cellule(m.surnom), cellule(m.membres), cellule(m.adresse),
        cellule(m.lat, false), cellule(m.lon, false),
        cellule(LIBELLES[e?.statut ?? 'todo']), cellule(e?.date), cellule(e?.note), cellule(e?.maj),
      ].join(';'),
    )
  }
  return `﻿${lignes.join('\r\n')}\r\n`
}

const deux = (n: number) => String(n).padStart(2, '0')

/** `2026-10-05-0630` en heure locale : l'enquêteur retrouve ses fichiers à l'heure de son téléphone. */
export const horodatage = (d = new Date()) =>
  `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}-${deux(d.getHours())}${deux(d.getMinutes())}`

export const nomFichier = (base: string, extension: string, d = new Date()) =>
  `fanisana-${base}-${horodatage(d)}.${extension}`
