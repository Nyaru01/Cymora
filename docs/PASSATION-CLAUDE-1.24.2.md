# Passation de Claude à Codex — Cymora 1.24.2

26 novembre 2026 · branche `Resonance` · suite de [la 1.22.6](PASSATION-CLAUDE-1.22.6.md)

## Changements

- **Nouveaux gestes (`game.js`).**
  - **Glisser :** `glideMotif`, `SLIDE` = 1,5 s, et `motifDegreeAt` qui respecte `note.glide`. Le score `glideOf(m, stroke, times, tempo)` mesure la régularité et l'allure, comparées à `reachTimes`. Ses retours possibles sont `fast`, `slow`, `shaky` et `missed`.
  - **Silence :** `restMotif`, `REST` = 1,2 s, et `retime()`, qui applique `note.rest` avant la note concernée. Le score `restOf(m, lifts, tempo)` donne les retours `none`, `short` et `long`.
  - **Tutoriels :** `glideLesson()` et `restLesson()`.
- **Répartition dans l'aventure.** `TIDES` passe à six chapitres, avec `resonate` (VI) en dernier.
  - **Qui reçoit quel geste :** `tideGlides` (III dès le chant 2, IV dès le chant 4, VI pour les chants 1, 2 et 5) et `tideRests` (IV dès le chant 2, VI pour les chants 2, 3 et 5).
  - **La composition :** `compose()` combine les tenues, les glissades et les silences. Une note ne porte jamais deux gestes, et la première note n'en porte aucun.
  - **Le chant 4 du VI** est un chant en mesure (`pulseMotif`).
  - **Les chants inchangés :** un chant sans glissade ni silence est identique à avant, donc les perles déjà gagnées gardent leur sens.
  - **La fin** se joue maintenant après le VI (`endOfTides`).
- **Accord en temps réel.**
  - **Le calcul :** `G.liveAccord(m, stroke, tempo)` est un DTW sur le début du chant, autour de l'avancée supposée. `stepLive` (dans `app.js`) le recalcule toutes les 0,2 s, et le lisse dans `this.live`.
  - **La jauge :** `this.gauge` lisse encore ce chiffre pour l'affichage. La jauge est dessinée dans `drawPlate` : un rail autour de la plaque, rempli depuis le haut, avec un repère doré au seuil (`passMark`). Elle devient entièrement dorée au-delà.
  - **Le tracé :** il passe du gris au doré, grâce à `mixHex`.
  - **Le reste :** une harmonie douce sonne quand le joueur est juste, et l'énergie de la matière suit l'accord.
  - **Le tutoriel « L'accord » :** il se joue une seule fois (clé `cymora.seen.accord`), avant le premier chant de l'aventure ou du jour. Il montre une carte, puis une consigne pendant le tour, et le repère de la jauge pulse.
- **Atelier (local seulement, `LOCAL`).**
  - **Les nouveaux ateliers :** « Glisser » et « Silence », à côté de Tenir et Pulsation.
  - **La lumière-guide :** elle avance à la vitesse du chant pour les chants qui contiennent une glissade.
  - **Le dessin des glissades :** elles sont dorées (`GLIDE_INK`), avec l'étiquette « lentement », fixée au milieu de la glissade complète.
  - **La courbe du chant :** `songOf` découpe le chant en phrases à chaque silence (`brk`), et prend 36 points par segment.
  - **Les pointillés :** ils sont espacés selon le temps du chant, plus selon la distance, et avancent à sa vitesse.
- **Corrections et interface.**
  - **Entrer dans le jeu :** `enterPlay()` est appelé par chaque `start*`. Une partie lancée depuis la carte ouverte sur l'accueil entre enfin dans le jeu.
  - **Le geste au bord de la plaque :** `toWorld` borne la position par un cercle, et non plus par un carré. Le tracé et sa traînée se fondent au bord de la plaque, grâce à `soft()`, un calque masqué par un dégradé radial.
  - **Le casque :** une seule invitation, sur l'accueil, avec une icône SVG en dégradé qui pulse. L'écran d'entrée dit seulement « Casque recommandé ».
  - **Le menu :** la rubrique « À propos » est raccourcie, et la version s'affiche seule (« Cymora x.y.z »).

## Vérifications

- Les 93 tests `npm test` passent (dont `tests/gestures.test.js`) et l'audit public est propre.
- **Simulations dans l'aperçu :**
  - Glisser : un tracé fidèle obtient 96 % ; trop vite ou trop lent donne le bon conseil.
  - Silence : le silence est mesuré à 1,2 s ; un doigt jamais levé échoue.
  - Accord en direct : environ 1,0 en suivant le chant, environ 0,5 en gribouillant.
  - Les deux nouveaux tutoriels passent bien par l'échec, puis par la réussite.
  - Le tutoriel « L'accord » fonctionne.
- **Reste à vérifier :**
  - le ressenti réel de la jauge et de la couleur du tracé ;
  - les ateliers et les chapitres III, IV et VI joués à la main ;
  - les vrais téléphones et l'iPhone.

## À savoir

- `public/vid/Avant video.mp4` est une copie locale de `accueil.mp4`. Elle n'est jamais commitée.
- Prochaines pistes : une récompense pour l'herbier complet, et des tests joués par de vrais nouveaux joueurs.
- Lors de ta prochaine publication, ajoute ta passation dans `docs/` et référence-la dans `REPRISE.md`.
