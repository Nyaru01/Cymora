# Passation de Claude à Codex — Cymora 1.22.6

26 novembre 2026 · branche `Resonance` · repart de ta 1.20.0

## Changements

- **Son (1.21.0).** Dans `public/src/audio.js` :
  - **Réverbération :** une réverbération synthétique (`impulse()`, environ 3,4 s, `ConvolverNode`) en parallèle de l'écho. L'écho est adouci (retour 0,3, part d'effet 0,3).
  - **Voix « verre » :** elle reçoit une seconde voix désaccordée de 7 cents et une sous-octave douce.
  - **Couleur du bourdon :** il prend une couleur par chapitre (`TONES`, et `audio.tone(id)` appelé depuis `setTone`). C'est une quatrième voix qui glisse vers une note de la gamme du jeu (la mineur pentatonique), si bien qu'elle ne sonne jamais faux avec le chant.
  - **Éclosion :** `audio.bloom(freqs, k)` joue une nappe soufflée, des éclats aigus et un gonflement du bourdon. Elle se déclenche à partir de la résonance (95 %) et plus fort au parfait (97 %).
  - **Polyphonie :** `MAX_VOICES` passe à 40.
- **Scène de fin (1.22.0).** `playEnding()` dans `app.js`, avec la section `#ending` dans le HTML.
  - **Les vidéos :** `vid/end_PC.mp4` (1280×720, environ 8 % de bandes noires, affichée agrandie ×1,18) ou `vid/end_mobile.mp4` (720×1280), selon l'écran (4:3 ou plus large pour le PC).
  - **Le son :** celui de la vidéo, qui respecte le réglage Son et le volume. Le bourdon du jeu s'efface pendant la vidéo.
  - **La fin de la vidéo :** les deux finissent très claires. Le fondu commence donc 2 s avant la dernière image et dure 3,2 s.
  - **Les déclenchements :** la scène se joue seule la première fois que le chapitre V est terminé (clé `cymora.seen.ending`), puis depuis l'entrée de menu « Revoir la fin ». En local (`LOCAL`), cette entrée est toujours visible pour les tests.
- **Crédits (1.22.1 à 1.22.6).** `showCredits(instant)`, avec la section `#credits`.
  - **L'enchaînement :** les crédits se placent sous la vidéo dès qu'elle commence à s'effacer (`then()` est appelé au début de `finish`). Un voile lumineux (`.credits.is-wash::after`, 4,2 s) prolonge la lumière finale de la vidéo. On arrive ensuite à l'accueil (`goHome`).
  - **La matière reste vivante derrière :** le voile est plus léger au centre, l'état passe à `play` et le mode à `menu`, donc `breathe()` tourne. La barre, le panneau et le murmure sont masqués par `body.is-credits`.
  - **Le chant des rubriques :** un `IntersectionObserver` sur la ligne centrale de l'écran déclenche une note montante, une pulsation et une éclosion à chaque rubrique, puis un accord complet au « Merci ».
  - **Les textes :** `credits.*` dans `strings.js`. La création est créditée à Virgil Czarnecki, nom donné par le propriétaire. Une rubrique vide est masquée.
  - **Le défilement :** une simple translation (`@keyframes creditsRoll`, 30 s), sans changer `top`, pour rester fluide sur mobile. Le texte a un seul halo, léger.
  - **Piège déjà corrigé :** l'`animationend` de la rosace (`creditsLogo`) remonte jusqu'au rouleau. On ne quitte les crédits que si `e.target === roll && e.animationName === 'creditsRoll'`.
- **Divers.** Les fondus d'apparition (`is-on`) passent par `setTimeout(…, 30)` au lieu de `requestAnimationFrame`, qui ne tourne pas quand la page est masquée.

## Vérifications

- Les 84 tests `npm test` passent et l'audit public ne remonte rien.
- **Dans l'aperçu :**
  - PC 1600×900 : `end_PC` joue avec le son, et « Passer » mène aux crédits.
  - Mobile 375×812 : `end_mobile` joue jusqu'au bout.
  - Les crédits sont déjà affichés au moment où la vidéo s'efface, et leur fin ramène à l'accueil.
  - La console n'affiche aucune erreur.
- **Le propriétaire a validé sur son téléphone** la transition, la fluidité et les crédits jusqu'au bout.
- **Reste à vérifier :**
  - l'écoute du nouveau son sur de vrais téléphones, en particulier le niveau de la réverbération ;
  - le chant des rubriques pendant le défilement, que l'aperçu met en pause ;
  - le comportement sur iPhone.

## À savoir

- `public/vid/Avant video.mp4` est une copie identique de `accueil.mp4`, laissée en local. Elle n'est jamais commitée.
- L'étape suivante du plan : les nouveaux gestes « glisser » et « silence », à essayer d'abord dans l'atelier local, puis une récompense pour l'herbier complet.
- Lors de ta prochaine publication, ajoute ta passation dans `docs/` et référence-la dans `REPRISE.md`.
