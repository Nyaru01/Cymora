# PELAGIC V2 « Nocturne » — rapport final de CLAUDE

*Rédigé le 2026-11-24 par CLAUDE (Anthropic Claude Code), en binôme avec CODEX.*

## 1. Point de départ

PELAGIC V1 (tag `v1.0.0` / `pelagic-v1`, commit 1e66482) est un océan de plancton simulé sur Canvas 2D. On y pose des tourbillons, des sources, des récifs et des balises qui chantent quand le plancton les traverse. Il reste intact dans Git.

Mon analyse indépendante de V1 relevait trois limites :

1. **On regarde plus qu'on ne joue.** Il faut placer un élément avant que l'eau réagisse.
2. **La musique est aléatoire.** Les notes tombent au gré des passages, sans pulsation ni forme.
3. **Le rendu plafonne.** 1 800 particules en Canvas 2D, sans lumière propre.

## 2. Ce que V2 change (décidé avec CODEX)

| Axe | V1 | V2 |
|---|---|---|
| Geste | placer des éléments | **Main** : toucher l'eau suffit, le plancton s'allume dans le sillage |
| Lumière | couleur selon la vitesse | **bioluminescence** : excitation, réfraction et halos (moteur CODEX), WebGL2 avec bloom |
| Population | 1 800 | jusqu'à **20 000** (SoA, environ 1,5 ms par pas) |
| Musique | une note par passage, une voix | **chef d'orchestre** : notes calées sur la croche, accents métriques, 4 voix, 4 gammes, tempo réglable |
| Forme | aucune | **Composer** : partition en 4 mouvements, fondus continus, boucle, export |
| Œuvre | Atlas de 6 tableaux | plus **« Ce que l'eau garde »**, nocturne écrite par CODEX, jouable en un clic |
| Trace | lien de partage | plus un **enregistrement audio** local (.webm) |

## 3. Ma part (fichiers et commits)

- **`src/render.js`** (5be0e0d) :
  - traînées ping-pong en RGBA16F, segments additifs, halos ;
  - bloom au quart de résolution et tone mapping ;
  - repli Canvas 2D complet si WebGL2 est absent ou perdu.
- **`src/tide.js`** (a251591, 1fb81d3) :
  - horloge de marée (`nextSlot`, `quantizeDelay`, `accentOf`) ;
  - `crossingsSoA` ;
  - `createConductor` : une note par case et par balise, délai jusqu'à la croche suivante, balises en fondu muettes sous 35 % d'opacité.
- **`src/audio.js`** :
  - 4 voix synthétisées (Verre, Cloche des abysses, Pizzicato, Souffle) et 4 gammes sur 3 octaves ;
  - écho modulé et scintillement pour les flashes de lumière ;
  - enregistrement MediaRecorder, sans micro ;
  - clés canoniques anglaises avec alias français.
- **`src/timeline.js`** : frise des mouvements (aperçus, tête de lecture, renommage, copie, durée).
- **`src/app.js`** : boucle à pas fixe de 1/60 s, modes, Main, transport de partition, édition gardée, capture automatique, persistance, export et import de partitions, accès permanent à la Nocturne.
- **`index.html`** et **`src/styles.css`** : interface V2 (sélecteur de modes, réglages musicaux, tiroirs, badge REC, frise, carte Nocturne, mobile).
- **Tests** : `render`, `tide`, `timeline` et `audio` complétés.

## 4. Audits croisés

**Audits de CODEX sur mon code, tous traités :**
- `canonicalScale('toString')` passait pour une gamme valide. Corrigé avec `Object.hasOwn`, test ajouté.
- Les lectures de `world.particles` (getter lent) dans les balises et l'historique sont remplacées par `world.p`.
- Il manquait un accès visible à la Nocturne. Ajouté : carte dans l'Atlas et bouton dans la frise.

**Mon audit de `engine.js` et `score.js` (CODEX) :**
- Les contrats sont respectés. `sampleScore` n'alloue jamais de particules.
- `applySample` conserve les identités par clé, donc la sélection et les flashes restent stables pendant les fondus.
- La limite de 24 pistes est bien globale.
- Seule réserve, non bloquante : `sampleScore` renvoie `count` venant du mouvement. L'interface l'ignore volontairement, car la population reste un choix de l'auditeur et la changer en cours de lecture coûterait une réallocation.

## 5. Vérifications réellement exécutées

- `npm test` : **57/57**, environ 6 s (limite de 120 s respectée).
- Navigateur, serveur local 127.0.0.1 :
  - console sans erreur ;
  - la Main allume le plancton ;
  - balise posée, copie de mouvement, lecture, pause qui revient au bon mouvement ;
  - partition persistée et restaurée au rechargement ;
  - Nocturne lancée depuis Explorer ;
  - retour à Explorer avec l'océan d'origine ;
  - 375 px sans débordement horizontal.
- Enregistrement réel (.webm d'environ 200 Ko, sans demande de micro) : testé par **CODEX** (voir son journal), pas par moi.
- Limite connue : le panneau de prévisualisation était masqué pendant mes essais, donc les images/s affichées (11 à 36) reflètent ce bridage et non les performances réelles. Les benchmarks moteur de CODEX donnent environ 1,1 à 1,5 ms par pas pour 20 000 particules.

## 6. Ce que je n'ai pas fait

- Aucune modification de `engine.js`, `score.js`, `nocturne.js` ni `server.mjs` (fichiers de CODEX).
- Pas d'Expéditions (objectifs guidés). Écartées d'un commun accord au profit de la partition.
