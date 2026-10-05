/** Case à bascule pleine largeur (44 px minimum), lisible par un lecteur d'écran comme un « switch ». */
export function Interrupteur({
  label, aide, actif, onChange,
}: {
  label: string
  aide?: string
  actif: boolean
  onChange: (valeur: boolean) => void
}) {
  return (
    <button
      role="switch"
      aria-checked={actif}
      onClick={() => onChange(!actif)}
      className="flex min-h-14 w-full items-center gap-3 rounded-[10px] border border-trait px-3 py-2 text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{label}</span>
        {aide && <span className="block text-sm text-brume">{aide}</span>}
      </span>
      <span className={`relative h-7 w-12 shrink-0 rounded-full ${actif ? 'bg-fait' : 'bg-trait'}`} aria-hidden="true">
        <span
          className={`absolute top-0.5 size-6 rounded-full bg-craie transition-[left] ${actif ? 'left-[22px]' : 'left-0.5'}`}
        />
      </span>
    </button>
  )
}
