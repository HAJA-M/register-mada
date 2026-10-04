export type Tokatrano = {
  id: string
  grappe: string
  segment: string
  fokontany: string
  faritra: string
  distrika: string
  kaominina: string
  no: string
  logement: string
  nbMenagesLogement: string
  noDansLogement: string
  chef: string
  surnom: string
  pa: 'P' | 'A' | ''
  membres: string
  adresse: string
  marika: string
  tratra: string
  lat: number | null
  lon: number | null
  precision: number | null
  altitude: number | null
  remarques: string
}

export const STATUTS = ['todo', 'encours', 'fait', 'refus', 'absent'] as const
export type Statut = (typeof STATUTS)[number]

export type Suivi = {
  id: string
  statut: Statut
  date: string // AAAA-MM-JJ
  note: string
  maj: string // ISO complet
}

export const estOuvert = (s: Statut) => s === 'todo' || s === 'encours'
