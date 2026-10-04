# register-mada — application de terrain pour le dénombrement RSU

Dépôt : https://github.com/HAJA-M/register-mada
Publié sur GitHub Pages à https://haja-m.github.io/register-mada/
Nom affiché dans l'application : **Fanisana**.

Réécriture locale d'un prototype HTML/Leaflet qui fonctionne déjà. Le prototype est dans
`legacy/` : lis-le avant de coder, la logique métier y est juste et testée sur le terrain.

## Le problème à résoudre

Un enquêteur marche dans un fokontany rural avec une liste de ménages déjà dénombrés. Il doit
retrouver chaque maison, faire son entretien, et cocher ce qui est fait. Son téléphone est un
Android d'entrée de gamme, en plein soleil, souvent sans réseau. L'écran doit répondre à une
seule question : **quelle maison je fais maintenant**.

Tout le reste est secondaire.

## Stack imposée

- Vite 6, React 19, TypeScript en mode strict
- MapLibre GL JS 5 (pas de wrapper React, un hook `useMap` suffit)
- Tailwind CSS v4, configuration CSS-first dans `src/styles/tokens.css`
- Dexie 4 pour la persistance (IndexedDB)
- Zustand pour l'état global
- vite-plugin-pwa (stratégie `injectManifest`, pas `generateSW` — on a besoin d'un contrôle
  fin sur le cache des tuiles)
- Vitest pour les tests unitaires, Playwright pour un parcours de bout en bout

Déploiement : GitHub Pages, build statique, via le workflow `.github/workflows/deploy.yml`.
Pas de serveur, pas de SSR.

`base: '/register-mada/'` dans `vite.config.ts`, sinon tous les chemins cassent sur Pages.
Même contrainte pour le service worker et le manifeste : `scope` et `start_url` relatifs,
jamais `/`. C'est le piège numéro un d'un déploiement en sous-dossier.

## Données

`src/data/tokatrano.json` — 77 fiches issues du dénombrement, 75 géolocalisées.
Ce fichier est en lecture seule, il ne doit jamais être modifié par l'application.

```ts
type Tokatrano = {
  id: string            // "RSU/0267/08/S01/17(1/1)" — clé stable, sert de clé de suivi
  grappe: string        // "RSU/0267/08"
  segment: string       // "S01"
  fokontany: string     // "ANTANAMBAO_11061608"
  faritra: string; distrika: string; kaominina: string
  no: string            // numéro d'ordre dans le segment
  logement: string      // numéro du logement dans le segment
  nbMenagesLogement: string
  noDansLogement: string
  chef: string          // nom complet du chef de ménage
  surnom: string
  pa: 'P' | 'A' | ''    // présent/absent au moment du dénombrement
  membres: string
  adresse: string
  marika: string        // description physique de la maison, c'est ce qui sert à la retrouver
  tratra: string        // phrase malagasy complète
  lat: number | null; lon: number | null
  precision: number | null   // en mètres
  altitude: number | null
  remarques: string
}
```

Le suivi saisi par l'enquêteur est séparé, stocké dans Dexie, indexé par `id` :

```ts
type Suivi = {
  id: string
  statut: 'todo' | 'encours' | 'fait' | 'refus' | 'absent'
  date: string          // ISO court, AAAA-MM-JJ
  note: string
  maj: string           // ISO complet, sert à arbitrer les fusions à l'import
}
```

Jamais de fusion des deux objets en base : les données du dénombrement et le travail de
l'enquêteur restent séparables, c'est ce qui permet de remplacer `tokatrano.json` sans perdre
la progression.

## Fonctionnalités

Reprendre à l'identique ce que fait `legacy/`, puis améliorer :

1. Carte plein écran, fond satellite, un repère numéroté par ménage coloré par statut.
   Les ménages terminés deviennent de petits points translucides.
2. Ruban de pointage : un trait par ménage dans l'ordre des numéros, coloré par statut,
   tapable pour ouvrir la fiche. C'est la signature visuelle de l'app, ne pas la banaliser.
3. Bouton « Suivant » : ouvre le ménage non traité le plus proche de la position courante.
4. Liste triable par numéro ou par distance, recherche sur nom, surnom, adresse et repère.
5. Fiche ménage : cinq statuts, date préremplie, note libre, toutes les données du dénombrement.
6. Annulation du dernier changement de statut pendant cinq secondes, avec vibration courte
   à la validation.
7. Position GPS en direct avec cercle de précision.
8. Téléchargement de la zone pour le hors ligne, avec barre de progression.
9. Export JSON et CSV, import JSON avec fusion sur `maj` la plus récente.
10. Mode plein soleil : contrastes renforcés, aucune transparence.

## Direction visuelle

Reprise des planches cartographiques de l'INSTAT qui servent de référence sur le terrain.

```css
--nuit:    #0E141A   /* chrome, pour que l'imagerie reste l'élément le plus lumineux */
--ardoise: #18212A
--trait:   #2A3742
--craie:   #ECF2F6
--brume:   #90A1AF
--carmin:  #B23A32   /* filet des limites communales, seul ornement, usage très parcimonieux */

--todo:    #F5B320
--encours: #4FA3E3
--fait:    #38C48C
--refus:   #E05A4E
--absent:  #7F8B97
```

Une seule famille typographique, la pile système. Chiffres en `tabular-nums` partout, les
nombres se comparent en permanence dans cette application.

Cibles tactiles de 44 px minimum : l'utilisateur marche en manipulant le téléphone.
Respecter `prefers-reduced-motion` et `env(safe-area-inset-*)`.

## Contraintes à ne pas perdre de vue

- **Hors ligne d'abord.** Chaque fonctionnalité doit se comporter correctement sans réseau.
  Aucune dépendance chargée depuis un CDN à l'exécution, tout est bundlé.
- **Une erreur de saisie coûte un déplacement.** Toute action destructive s'annule.
- **Pas de perte de données.** Écriture dans Dexie avant tout retour visuel, et prévenir
  l'utilisateur si le quota de stockage est atteint.
- Deux fiches de la grappe 08 segment S01 ont des coordonnées fausses, à environ 6 km
  (précisions de 56 m et 100 m). Les exclure du calcul de l'emprise à télécharger et du
  cadrage automatique, mais les garder dans la liste.
- Trois fiches n'ont pas de GPS : l'interface ne doit jamais supposer que `lat` existe.

## Étapes proposées

1. Échafaudage Vite, tokens Tailwind, couche Dexie et store Zustand, avec des tests sur la
   fusion à l'import et le calcul de distance.
2. Carte MapLibre et repères, sans interaction.
3. Feuille du bas : ruban, compteurs, liste, recherche et tri.
4. Fiche ménage et changements de statut avec annulation.
5. Service worker, téléchargement de zone, écran hors ligne.
6. Export, import, réglages.

Avant de passer à l'étape suivante, lancer `npm run build` et vérifier que le résultat
fonctionne hors ligne en coupant le réseau dans les outils de développement.
