# QUATRE — une exposition horizontale

CODEX · 24 novembre 2026

## Intention

Le document demandé est une exposition, pas une liste de versions. Quatre salles à l’échelle de l’écran racontent quatre changements de relation : composer, jouer, écouter, laisser exister. Une ligne de progression rapproche les œuvres tout en montrant leur rupture. La quatrième quitte l’eau noire pour le papier.

## Forme

`EXPOSITION.html` est un fichier autonome : typographies système, CSS, JavaScript et quatre études animées dessinées au Canvas, sans image distante, police téléchargée, dépendance ou appel réseau. Format horizontal à défilement natif avec ancrages et boutons. Sur écran étroit, la visite conserve quatre salles lisibles, avec un défilement horizontal manuel et des contrôles accessibles. Le mouvement réduit est respecté.

Les études graphiques représentent chaque génération et réagissent au pointeur ; elles ne sont pas présentées comme les moteurs complets. Les expériences originales sont accessibles séparément depuis le serveur local, à partir des trois tags préservés et du dossier INTERVALLE courant. Le fichier ouvert directement reste une exposition complète ; les liens d’expériences expliquent simplement comment démarrer le serveur.

## Direction artistique

Fond ivoire, lettres charbon, titres serif très grands, petits repères techniques en monospace. Chaque salle possède une couleur d’encre et une fenêtre graphique vaste. Cartels courts, faits vérifiables, geste interactif unique et détail consultable au clic. Aucun chiffre de performance hors contexte ni promesse de test humain inexistant. La salle IV rend visible le désaccord CONTREPOINT / INTERVALLE et donne accès aux conclusions indépendantes des deux auteurs.

## Interaction et vérification

- Navigation par boutons, ancrages, flèches quand aucun contrôle ne consomme la touche, défilement tactile et molette native.
- Le Canvas de la salle active seulement est animé ; résolution plafonnée et simulation décorative bornée.
- Texte et navigation restent accessibles sans Canvas ; pas de son déclenché automatiquement.
- Arrêt des animations par un bouton et par `prefers-reduced-motion` ; aucun détournement du zoom navigateur.
- Vérifier les quatre salles, le détail, le petit écran, les liens locaux, le comportement hors ligne et l’absence d’erreurs navigateur.

## Choix refusés

Quatre applications en iframes simultanées auraient rejoué la surcharge de Nocturne. Une galerie d’images statiques aurait masqué la nature interactive des œuvres. Les études originales sont légères ; les expériences complètes s’ouvrent à la demande. La galerie est le récit des quatre projets, pas un cinquième projet artificiellement comptabilisé.
