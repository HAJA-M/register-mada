/** Part de la hauteur d'écran prise par la fiche repliée (`h-[52dvh]` dans Fiche.tsx). */
export const PART_FICHE = 0.52

/** Marge basse de la carte : le ménage choisi doit rester visible au-dessus de la fiche. */
export const margeBas = () => Math.round(window.innerHeight * PART_FICHE) + 12

/** Marge basse pour le cadrage d'ensemble : la feuille repliée prend environ 30 % de l'écran. */
export const margeFeuille = () => Math.round(window.innerHeight * 0.32)
