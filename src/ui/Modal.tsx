import { useEffect, type ReactNode } from 'react'
import { useStore } from '../store'

/** Feuille pleine largeur au-dessus de l'écran (voile, titre, croix, contenu défilant). */
export function Modal({
  titre, fermable = true, children,
}: {
  titre: string
  /** Faux pendant une opération qu'il ne faut pas interrompre sans le dire (téléchargement en cours). */
  fermable?: boolean
  children: ReactNode
}) {
  const ouvrirPanneau = useStore((s) => s.ouvrirPanneau)
  const fermer = () => fermable && ouvrirPanneau(null)

  useEffect(() => {
    const echap = (e: KeyboardEvent) => e.key === 'Escape' && fermer()
    addEventListener('keydown', echap)
    return () => removeEventListener('keydown', echap)
  })

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end">
      <button aria-label="Fermer" onClick={fermer} className="scrim absolute inset-0 cursor-default" tabIndex={-1} />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={titre}
        className="anim-monter relative flex max-h-[88dvh] flex-col rounded-t-[14px] border-t border-trait bg-ardoise pb-[env(safe-area-inset-bottom)]"
      >
        <div className="flex items-center gap-2 px-4 pb-2 pt-4">
          <h2 className="flex-1 text-xl font-bold">{titre}</h2>
          <button
            onClick={fermer}
            disabled={!fermable}
            aria-label="Fermer"
            className="grid size-11 place-items-center rounded-[10px] border border-trait disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 pb-4">{children}</div>
      </section>
    </div>
  )
}
