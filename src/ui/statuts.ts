import type { Statut } from '../types'

// Classes complètes (pas de concaténation) pour que Tailwind les détecte.
export const FOND: Record<Statut, string> = {
  todo: 'bg-todo',
  encours: 'bg-encours',
  fait: 'bg-fait',
  refus: 'bg-refus',
  absent: 'bg-absent',
}
