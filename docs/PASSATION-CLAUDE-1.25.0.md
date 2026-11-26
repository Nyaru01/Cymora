# Passation de Claude à Codex — Cymora 1.25.0

26 novembre 2026 · branche `Resonance` · suite de [la 1.24.2](PASSATION-CLAUDE-1.24.2.md)

## Changements

- **Un geste à la fois pour un joueur neuf (`app.js`).**
  - **Le premier chant** (clé `cymora.seen.first`, posée au premier chant jugé en aventure ou au chant du jour) n'apprend que « écoute, puis retrace ».
    - Le getter `firstSong` choisit les consignes : `w.firstCall` pendant le chant, `w.firstTurn` ou `w.firstTurnPc` pendant le tour.
    - La jauge d'accord reste cachée. Elle ne se dessine que si le tutoriel est en cours ou déjà vu, et toujours dans l'atelier et le mode libre.
  - **Le tutoriel « L'accord »** passe dans `accordFirst()`. Il se joue au chant suivant (`newMotif`) ou au nouvel essai (`afterEcho`, cas `again`), et n'apparaît plus avant le tout premier chant.
- **Les cartes se passent d'un toucher.** Pendant un interlude où une carte est affichée (depuis plus de 0,8 s), `beginTouch` cache la carte et ramène la fin de l'interlude à 0,7 s.
  - **La mention :** « Touche pour continuer » (« Clique pour continuer » sur PC), dans `#card-skip`. Elle pulse après 2,2 s et reste fixe si les animations sont réduites.
  - **La carte « L'accord »** dure maintenant 9 s, avec un interlude de 8 s, puisqu'on peut la passer.
- **Correctif :** le regard qui suit la souris appelait `addWake` avec un rayon de 0,008 ou 0,016, sous le minimum de 0,02 du moteur. Chaque mouvement de souris levait donc une erreur. L'onde a maintenant un rayon de 0,02 et n'est créée qu'une fois toutes les 240 ms.

## Vérifications

- Les 93 tests passent et l'audit public est propre.
- **Simulation** sur un profil vide :
  - la carte du chapitre I se passe d'un toucher ;
  - les consignes du premier chant s'affichent, sans jauge ;
  - la carte « L'accord » arrive avant le deuxième chant, et sa consigne pendant le tour.
- Plus aucune erreur console quand la souris bouge.
- **Reste à vérifier :**
  - le rendu de la mention sous les cartes, sur mobile et sur PC ;
  - un vrai test par un nouveau joueur.

## À savoir

- `public/vid/Avant video.mp4` reste local et n'est jamais commité.
- **Pistes suivantes :**
  - la récompense pour l'herbier complet ;
  - le confort sur téléphone (gaucher, volumes séparés) ;
  - le chant du jour à partager.
- À ta prochaine publication, ajoute ta passation dans `docs/` et référence-la dans `REPRISE.md`.
