# Génération V — ce que CLAUDE a réellement vérifié

Auteur : CLAUDE. Date : 24 novembre 2026.

Ce document ne dit que ce qui a été exécuté. Ce qui n'a pas été fait est listé à la fin, sans adoucissement.

## Conditions

- **Navigateur** : le panneau Chromium intégré à l'application Claude.
  - Les tailles sont émulées (`resize_window`) avec un rapport de pixels de 1.
  - Ce ne sont pas de vrais téléphones ni de vrais écrans 4K.
- **Serveurs utilisés** :
  - le serveur de production de CODEX (`server.mjs`, port 4177) pour QUATRE, Nocturne, `/rapports/` et les en-têtes ;
  - mon serveur statique de prévisualisation (port 4175, sans CSP), qui sert le même dossier `public/`, pour mes pages.
- **Animation ralentie** : quand le panneau est caché, il ralentit `requestAnimationFrame`. Pour photographier INTERVALLE en cours de rencontre, j'ai avancé la rencontre de 260 tours avec le crochet `?debug` (`__intervalle.tick`).
  - Ce crochet appelle le même `arena` que l'œuvre ; il ne change aucune règle.
- **Captures** : `docs/captures/g5-claude/`. Ce sont des JPEG réduits par l'outil, jusqu'à 800 px de large, pas des captures pleine résolution.

## Tests automatisés

- **`npm test`** (fait) : 74 tests, 74 réussis, 0 échec. Durée 7,1 s.
  - L'échantillon de simulation donne 2,71 ms par pas pour 20 000 particules. C'est une mesure **moteur**, pas une mesure de rendu ni de l'expérience complète.
- **`tests/oeuvres.test.js`** (mes tests) vérifie :
  - que les politiques IV sont identiques à celles de v4.0.0 ;
  - la parité FR/EN ;
  - le graine 8 : 542 tours et refus [7, 0] ;
  - la couverture de traduction de Jardin ; depuis cette vérification, elle inclut les légendes dessinées sur le canevas et les noms de notes ;
  - la structure de La fabrication.

## Parcours en navigateur (fait)

### Pages, tailles et langues

| Page | Tailles mesurées | Langues | Constat |
|---|---|---|---|
| Intervalle | les 10 tailles de la consigne (mesure par iframe, avant cette passe) ; 1920×1080 et 844×390 photographiées | FR, EN | aucun débordement ; marges visibles à côté de la feuille |
| Résonance | les 10 tailles (iframe) ; 1920×1080, 844×390 et 390×844 photographiées | FR, EN | invitation au paysage affichée en portrait ; « Continuer ainsi » est retenu pour la séance |
| Jardin | les 10 tailles (iframe) ; 1920×1080 et 844×390 photographiées | FR, EN, bascule à chaud | **défaut trouvé puis corrigé** : voir plus bas |
| La fabrication | 1920×1080, 844×390, 390×844, 3840×2160 | FR, EN | aucun débordement, aucune erreur console |
| QUATRE (CODEX) | 1280×720, 844×390, 390×844, 3840×2160 | FR, EN | galerie horizontale fonctionnelle ; détails dans `.agents/CLAUDE.md` |
| Nocturne (CODEX) | 844×390, 3840×2160 | FR, EN | composition testée : une note posée est gardée au rechargement |

### Liens directs, rechargements, en-têtes

- `/oeuvres/intervalle` redirige en 308 vers `/oeuvres/intervalle/`.
- `?lang=en` est mémorisé d'une page à l'autre.
- `/health` répond.
- Ces chemins renvoient 404 : `/server.mjs`, `/package.json`, `/.agents/…`, `/docs/…`, `/../server.mjs`.
- En-têtes présents : CSP, `nosniff`, Permissions-Policy (caméra et micro coupés), COOP, `frame-ancestors 'none'`.

## Défauts trouvés pendant cette vérification

### Dans mes fichiers (corrigés)

1. **Jardin, en anglais** : le canevas dessinait encore « PROFONDEUR », « COURANT DOMINANT » et les noms de notes en solfège (Ré4, La3).
   - Mon test de couverture ne lisait que les messages, pas les `fillText`.
   - Correction : légendes traduites, noms de notes anglais (D4, A3), fond redessiné au changement de langue.
   - Le test vérifie désormais les deux.
2. **Intervalle** : « 1 cases d'encre » devient « case(s) d'encre » ; « ink cells » devient « ink cell(s) ».
3. **Nom de la page éditoriale** : « La fabrication / The making », comme le lien de QUATRE. Cela évite la collision avec le bouton « Atelier » de Nocturne.

### Chez CODEX (transmis dans le journal, non corrigés par moi)

1. Le serveur 4177 sert `/atelier/` en 404 : son inventaire a été construit avant la création de mes fichiers. Un redémarrage suffit.
2. Nocturne en anglais affiche des notes en solfège.
3. À 3840×2160 avec DPR 1, Nocturne et QUATRE gardent une interface de taille 1080p.
4. Le champ d'eau de Nocturne devient bas en mode Composer à 844×390.
5. QUATRE a des cibles tactiles de 33 à 36 px dans l'en-tête en paysage téléphone.

## Non vérifié

- **Appareils** : aucun vrai téléphone ni vraie tablette, aucun Safari iOS. Le toucher a été simulé par des clics.
- **Son** : rien n'a été écouté. Le panneau ne restitue pas l'audio ; je n'ai vérifié que l'absence d'`AudioContext` avant un geste.
- **Lecteurs d'écran** : aucun lecteur réel ; seuls les attributs ARIA ont été lus.
- **Repli sans WebGL2** : non vérifié dans le navigateur. Il est couvert seulement par un test unitaire (`createRenderer` se replie sur Canvas 2D).
- **Mémoire** : aucune mesure sur une longue durée.
- **Performances** : pas d'images par seconde mesurées en navigateur, puisque le panneau caché ralentit l'animation.
- **Tailles photographiées** : 1366×768, 2560×1440, 3440×1440, 667×375, 915×412 et 932×430 n'ont pas été photographiées dans cette passe. Pour mes trois œuvres, elles ont été mesurées par iframe ; elles ne l'ont pas été pour QUATRE ni Nocturne.
- **Déploiement** : aucun déploiement Railway et aucun push. Ces opérations sont sous la responsabilité de CODEX, et je n'ai vu aucune URL publique.
