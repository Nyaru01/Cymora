# Rapport final — CLAUDE

Agent : **CLAUDE** (Anthropic Claude Code), 24 novembre 2026.
Partenaire : CODEX. Projet : **PELAGIC — le jardin des courants**.

## 1. Arrivée dans le projet

À mon arrivée, CODEX avait déjà initialisé `PROJECT.md` avec le concept PELAGIC, un contrat moteur et une répartition des rôles. J'ai choisi d'**adopter ce concept** plutôt que d'en proposer un autre. Il était original : un instrument océanique, pas un CRUD. Il laissait aussi une place claire à une contribution complémentaire : l'interface, la direction artistique et le son. J'ai confirmé ce choix dans `.agents/CLAUDE.md` et proposé trois extensions du contrat (`beacon`, `moveNode`, `removeNode`). CODEX les a acceptées et implémentées en quelques minutes.

## 2. Mes contributions

| Fichier | Contenu |
|---|---|
| `index.html` | Structure sémantique : barre d'outils en `radiogroup`, carnet de bord, réglages, son, Atlas, partage, inspecteur, dialogue d'aide, lien d'évitement, régions `aria-live`. |
| `src/styles.css` | Identité « instrument scientifique nocturne » : encre, menthe et corail, titre en italique éditorial, chiffres en mono tabulaires, hublot gradué, mise en page responsive avec barre d'outils fixe en bas sur mobile, `prefers-reduced-motion`. |
| `src/app.js` | Rendu Canvas (traînées sur calque séparé en composition additive, couleur selon la vitesse en échelle log, glyphes animés par type d'élément, graduations « profondeur »), sonar défilant des notes, interactions (souris, toucher, molette, clic droit, curseur clavier), inspecteur, historique annuler/rétablir, sauvegarde automatique, lien de partage `#w=`, export/import, photo PNG, immersion, gestion des erreurs (moteur absent, import refusé, stockage indisponible). |
| `src/audio.js` | Sonification Web Audio : carillon FM (rapport 3,5, timbre « verre »), gamme pentatonique sur trois octaves (hauteur = profondeur de la balise), panoramique = position horizontale, écho filtré réinjecté, compresseur et polyphonie limitée à 24 voix. Aucun échantillon externe. |
| `src/ui.js` | Fonctions pures testables : géométrie, détection des passages, base64url UTF-8, bornes de force, descriptions accessibles. |
| `src/atlas.js` | Six compositions : Gyre, Détroit, Fontaine abyssale, Puits, Allée des tourbillons, Page blanche. |
| `tests/ui.test.js`, `tests/audio.test.js`, `tests/atlas.test.js` | 14 tests, dont un qui garantit qu'**aucune balise de l'Atlas n'est muette** : chaque balise est traversée en 60 s simulées au plus. |

## 3. Décisions notables (et pourquoi)

- **Détection des passages côté interface, moteur pur.** La balise n'a aucun effet physique : c'est l'interface qui écoute. Le moteur de CODEX reste déterministe et testable sans DOM.
- **Monde carré dans un hublot gradué.** Le moteur travaille dans [0,1]². Étirer ce carré sur un écran large aurait déformé les tourbillons en ellipses. Le carré inscrit, avec ses graduations, devient l'identité visuelle elle-même.
- **Son opt-in, mais visible sans son.** Le sonar montre chaque note, même son coupé : l'expérience reste lisible sans audio et accessible aux personnes sourdes ou malentendantes.
- **Lien de partage dans le fragment `#`.** Le fragment n'est jamais envoyé au serveur, et il passe par la même validation stricte que l'import (`deserializeWorld`).
- **L'annulation conserve le plancton.** Une désérialisation régénère normalement les particules. Je réinjecte les particules courantes pour que Ctrl+Z ne « saute » pas visuellement.
- **Inspecteur tactile.** Sans lui, régler la force exigeait une molette. Je l'ai ajouté après mon auto-audit.

## 4. Audit croisé

**Ce que j'ai trouvé chez CODEX :**
- **Bloquant :** `STOP.ps1` ne se parsait pas. Une apostrophe typographique `’` dans une chaîne `'…'` est interprétée comme un guillemet par PowerShell. Je l'ai reproduit en exécution réelle, j'ai arrêté l'instance proprement avec son jeton et je l'ai signalé. CODEX a corrigé et réencodé les scripts en UTF-8 BOM.
- Comparaison du jeton d'arrêt sans `timingSafeEqual` (corrigé), marqueur `.runtime` périmé (corrigé), messages moteur « balise » ambigus (corrigé en « élément »).
- `velocityAt` ignorait `strength` pour les récifs (signalé au cycle 7). CODEX a appliqué la formule proposée (taille et intensité proportionnelles à |force|, force 1 inchangée) avec un test de régression.
- Documentation : README fidèle, mais mes derniers ajouts y manquaient et `TASKS.md` était resté à l'état initial (signalé au cycle 8).

**Ce que CODEX a trouvé chez moi (et que j'ai corrigé) :** débordement mobile, contrastes trop faibles et textes trop petits, compteur « Notes jouées » ambigu, mouvement non réduit sous `prefers-reduced-motion`.

**Ce que j'ai trouvé chez moi :** `display:grid` sur la couche d'erreur annulait `hidden` et masquait tout l'océan (règle `[hidden]` globale), traînées trop courtes, graduations rognées, réglage de force impossible au toucher, récifs et balises négatifs possibles alors qu'ils n'ont pas de sens.

## 5. Vérifications réellement effectuées

- `npm test` : **25/25** au dernier passage, après le correctif récif de CODEX. L'Atlas reste entièrement sonore.
- Navigateur intégré, bureau et 375 × 812 :
  - placement des quatre types, glisser, molette, clic droit ;
  - Atlas (Détroit), son activé (`AudioContext` en état *running*, compteur de passages qui augmente) ;
  - export/import aller-retour, lien `#w=` aller-retour, lien invalide refusé avec message ;
  - « Vider » puis « Annuler » ;
  - historique (4 annulations, puis 1 rétablissement, le plancton est conservé) ;
  - immersion entrée/sortie, inspecteur (force, inversion, retrait) ;
  - `toBlob` PNG ;
  - aucun défilement horizontal à 375 px (`scrollWidth` 375) ;
  - aucune erreur console.
- `START.ps1` ×2 (la seconde exécution détecte l'instance), `/__stop` sans jeton → 403, avec jeton → 202.

**Non vérifié par moi :**
- La qualité **auditive** du son : je ne peux pas l'écouter. J'ai vérifié l'état du contexte audio et les appels, pas le rendu perçu.
- Le téléchargement effectif des fichiers (export et photo) : je n'ai pas cliqué de téléchargement réel, seulement vérifié la génération du Blob.
- Les images/s mesurées dans le panneau de prévisualisation (10 à 25) sont limitées par cet environnement. Un pas moteur et un rendu mesurés coûtent chacun environ 0,6 ms pour 1 800 particules.

## 6. Limites connues

- Le lien de partage contient l'adresse locale : il ne sert qu'à une machine qui exécute PELAGIC. Le fichier JSON reste le moyen de transfert.
- Pas d'export audio. Le sonar est une visualisation, pas un enregistrement.
- Le curseur clavier du canevas est fonctionnel, mais un lecteur d'écran n'en reçoit que des annonces textuelles via la région `aria-live`.

## 7. Cycles

J'ai réellement exécuté 8 cycles, chacun consigné et horodaté dans `.agents/CLAUDE.md` : interface initiale, intégration, audit CODEX, Atlas, historique/photo/immersion, inspecteur, audit documentation, rapport. Je me suis arrêté là, comme convenu avec CODEX après son gel fonctionnel, plutôt que d'ajouter des fonctionnalités pour atteindre 30 cycles. La limite de 30 cycles est un maximum, pas un objectif.
