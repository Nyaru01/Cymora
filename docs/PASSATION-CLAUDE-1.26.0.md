# Passation de Claude à Codex — Cymora 1.26.0

26 novembre 2026 · branche `Resonance` · suite de [la 1.25.0](PASSATION-CLAUDE-1.25.0.md)

## Changements

- **L'herbier complet récompensé (`app.js`).** Le getter `herbierComplete` est vrai quand les 6 × 5 chants sont au-dessus de `G.PASS`.
  - **La grande rosace.** Elle s'affiche dans `#herbier-crown`, en haut de l'herbier : `startCrown()` lance une boucle d'animation, et `drawCrown()` superpose les 30 tracés, un anneau par chapitre, qui tournent. La boucle s'arrête à la fermeture de l'herbier. En `LOCAL`, la rosace est toujours visible, avec la mention « Aperçu local ».
  - **Le chant de l'herbier.** `playCrown()` enchaîne une phrase par chapitre (son chant le mieux accordé, à 0,82 du tempo), puis un accord final. Il passe par `herbierPlayback` (`crown: true`, et `lit` désigne l'anneau qui s'allume).
  - **La teinte nacrée.** Le réglage `settings.nacre` met la classe `body.is-nacre`, qui active la variable CSS `--tint`. Le plancton se teinte vers `NACRE_INK`. Le réglage se débloque avec l'herbier complet, ou en `LOCAL`.
  - **L'annonce.** Quand le dernier chant est accordé, un toast s'affiche, avec un bouton « La voir ».
- **Le confort sur téléphone.**
  - **La musique de fond :** `settings.ambience`, avec `audio.setAmbience()`. Le bourdon passe maintenant par un bus `ambBus`, branché sur `master`.
  - **La plaque plus basse :** `settings.low`, en portrait seulement, géré dans `resize()`. La ligne du menu, `.menu__row--phone`, est cachée en mise en page large.
- **Des chapitres plus distincts.**
  - **Le plancton :** `MOTES` donne les paramètres de chaque chapitre (`rise`, `drift`, `sway`, `swirl`, `size`, `flash`, `density`, `beat`). `drawMotes` intègre maintenant les positions par pas de temps, et rejoint en douceur le style du chapitre (`this.moteStyle`).
  - **La signature :** `THEMES` et `playTheme(id)`, appelée par `startTide`, jouent quelques notes de cloche pendant la carte du chapitre.
- **Correctif CSS.** `--matter: none` rendait invalides les filtres composés (`var(--matter) brightness(...)`), donc la matière ne s'assombrissait pas sous les cartes au chapitre I et en mode libre. La valeur neutre est maintenant `brightness(1)`.

## Vérifications

- Les 93 tests passent et l'audit public est propre.
- **Dans l'aperçu :**
  - la rosace se dessine et son chant se lance ;
  - la nacre s'applique ;
  - la plaque basse descend de 140 px sur un écran de 375 × 812 ;
  - le style du plancton converge vers celui du VI.
- **Pas vérifié :**
  - l'écoute du chant de l'herbier et des signatures ;
  - le mouvement réel du plancton à l'écran ;
  - la fluidité sur un Android d'entrée de gamme.

## À savoir

- `public/vid/Avant video.mp4` reste local et n'est jamais commité.
- **Pistes suivantes :** le chant du jour à partager, et un test par de vrais nouveaux joueurs.
- À ta prochaine publication, ajoute ta passation dans `docs/` et référence-la dans `REPRISE.md`.
