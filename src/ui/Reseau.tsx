import { useEnLigne } from '../lib/useEnLigne'

/** Pastille discrète quand le téléphone n'a plus de réseau : tout le reste continue de fonctionner. Placée dans la colonne de boutons. */
export function Reseau() {
  if (useEnLigne()) return null
  return (
    <p
      role="status"
      className="flex min-h-8 items-center gap-2 rounded-full border border-trait bg-ardoise px-3 text-sm shadow-md"
    >
      <i className="size-2 rounded-full bg-todo" />
      Hors ligne
    </p>
  )
}
