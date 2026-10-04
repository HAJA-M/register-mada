# Fanisana — suivi de terrain des tokatrano

Application cartographique hors ligne pour suivre l'avancement des visites de ménages.
Données : dénombrement RSU, AE **EQ_TANN_0267**, Commune Ambohitrabiby — 77 tokatrano, 75 géolocalisés.

## Ce que fait l'application

- Carte satellite (Esri World Imagery, le même fond que les planches INSTAT) ou plan OSM
- Un repère par ménage, numéroté, coloré selon le statut ; les ménages terminés s'effacent en petits points pour laisser voir le travail restant
- Ruban de pointage : un trait par ménage, dans l'ordre des numéros, pour voir l'avancement d'un coup d'œil et sauter directement à une fiche
- Bouton « Suivant » qui ouvre le ménage non traité le plus proche de vous
- Statuts : à faire, en cours, terminé, refus, absent, avec annulation du dernier changement
- Date de visite et note libre par ménage
- Tri de la liste par numéro ou par distance, avec la distance affichée sur chaque ligne
- Recherche par nom, surnom, adresse ou repère
- Position GPS en direct pour se situer par rapport aux ménages
- Mode plein soleil : contrastes renforcés pour la lecture en extérieur
- Téléchargement de la zone pour travailler sans réseau
- Export de la progression en JSON et en CSV, réimport depuis une sauvegarde

La progression est enregistrée dans le navigateur du téléphone (localStorage). Elle n'est pas
synchronisée entre appareils : exportez le JSON pour transférer ou fusionner.

## Mise en ligne sur GitHub Pages

1. Sur github.com, créez un dépôt public, par exemple `fanisana`.
2. **Add file → Upload files**, déposez tout le contenu de ce dossier en respectant
   l'arborescence (`index.html` doit être à la racine du dépôt, pas dans un sous-dossier).
3. **Settings → Pages → Build and deployment**, source **Deploy from a branch**,
   branche `main`, dossier `/ (root)`. Enregistrez.
4. Après une à deux minutes, l'adresse `https://<votre-compte>.github.io/fanisana/` répond.

Le HTTPS de GitHub Pages est indispensable : sans lui, ni le service worker ni la géolocalisation
ne fonctionnent.

## Installation sur le téléphone

- **Android / Chrome** : ouvrez l'adresse, menu ⋮ → *Ajouter à l'écran d'accueil*.
- **iPhone / Safari** : bouton Partager → *Sur l'écran d'accueil*.

L'application s'ouvre alors en plein écran, sans barre de navigateur.

## Avant de partir sur le terrain

En wifi, ouvrez le menu → **Télécharger la zone**. Environ 770 images satellite, à peu près 16 Mo,
couvrant les quatre segments du niveau 14 au niveau 18 (zoom rue). Une fois le téléchargement
terminé, la carte s'affiche sans aucune connexion.

Si vous changez de fond de carte, relancez le téléchargement : satellite et plan sont deux jeux
d'images distincts.

## Mettre à jour les données des ménages

Le fichier `data.json` contient les fiches. Pour en ajouter ou en corriger, modifiez ce fichier
et renvoyez-le sur GitHub. Pensez à changer le numéro de version du cache dans `sw.js`
(`fanisana-shell-v1` → `v2`) pour que les téléphones déjà installés récupèrent la nouvelle version.

Les statuts saisis sont conservés : ils sont rattachés au code du ménage
(`RSU/0267/08/S01/17(1/1)`), pas à sa position dans le fichier.

## Attention aux deux points aberrants

Les ménages 4 et 5 de la grappe 08 segment S01 ont des coordonnées fausses
(−18,8377 / 47,5570, soit environ 6 km au sud-ouest). Ils apparaissent isolés sur la carte et sont
exclus du calcul de la zone à télécharger. À corriger sur le terrain avec un nouveau relevé.
