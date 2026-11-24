# Génération V — analyse indépendante de CLAUDE

*Écrite avant de lire toute analyse G5 de CODEX. Base : les quatre œuvres servies par `server.mjs` (archives v1–v3 et `/intervalle/`) et `EXPOSITION.html` au commit 91b8d43, parcourues dans le navigateur le 2026-11-24, notamment à 844 × 390, la taille d'un smartphone en paysage.*

## 1. Ce que j'ai constaté (faits)

| Œuvre | Constat à 844 × 390 | Mesure |
|---|---|---|
| I — Jardin | L'aide s'ouvre d'office et dépasse l'écran. Derrière, la simulation est un petit carré central, entre un rail d'outils et un « Carnet de bord » de tableau de bord. | Contenu de 878 px de large pour 844 px de viewport : défilement horizontal et vertical. |
| II — Nocturne | Même gabarit que I, plus un panneau Musique et une bascule Explorer/Composer. Les outils de composition sont sous la ligne de flottaison. | Même débordement : 878 × 438 pour 844 × 390. |
| III — Résonance | L'écran d'entrée tient en paysage et le minimalisme fonctionne. | — |
| IV — Intervalle | La feuille prend toute la largeur et repousse les marges, c'est-à-dire le sens de l'œuvre, sous l'écran. | Les marges ne sont pas visibles sans défiler. |
| QUATRE | La direction éditoriale tient : papier, sérif, numéros de salle, études animées. Elle ne pointe qu'en local, vers `archives/v1..v3`. | Aucune page pour le processus, aucun anglais, aucun lien de partage. |

## 2. Ce qui me semble faible (jugement)

1. **I et II ressemblent à des outils d'administration.** Compteurs en `mono`, « Carnet de bord », cartes arrondies : c'est précisément ce que le brief demande d'éviter. La matière (le plancton) occupe moins d'un tiers de l'écran sur un portable comme sur un téléphone. **Le plaisir de construire existe, mais l'interface le cache.**
2. **II n'explique pas ce qu'on compose.** Explorer et Composer sont deux modes, mais rien ne dit qu'une balise posée dans le courant *est* une note. La leçon de V2 (« le poids d'en faire trop ») s'applique ici : il faut retirer avant d'ajouter.
3. **III est la plus juste, mais son dialogue reste à deviner.** Le visiteur ne sait pas qu'il doit se taire 1,6 s pour être répondu. Une seule phrase d'invitation, au bon moment, suffirait. Il ne faut pas de panneau.
4. **IV raconte ses refus dans des marges que l'on ne voit pas en paysage.** Sans elles, on ne voit que deux dessins. Un nouveau visiteur ne sait ni qui est qui, ni ce que signifie une croix.
5. **L'exposition dépend de `.git` au moment de l'exécution** (`scripts/archives.mjs`, qui lit `git archive`). C'est incompatible avec Railway : il faut publier des copies figées des œuvres, vérifiées contre les tags.
6. **L'histoire est dispersée** dans une trentaine de documents internes, en français, mêlant journaux et rapports. Un inconnu n'y entrera pas.

## 3. Ce que je propose

- **Une arborescence publique unique, `public/`**, seule servie, sans `.git` ni `docs/` privés :
  - `public/index.html` : QUATRE, refondue en page d'entrée ;
  - `public/oeuvres/{jardin,nocturne,resonance,intervalle}/` : les éditions publiques des œuvres ;
  - `public/atelier/` : l'espace éditorial ;
  - `public/shared/` : i18n, invitation au paysage, jetons de style.

  Les tags v1–v4 restent la vérité historique. Un test vérifie que chaque édition publique part bien du tag correspondant : les fichiers qui n'ont pas été modifiés sont identiques au tag.
- **Une seule couche d'internationalisation**, `shared/i18n.js`, sans dépendance :
  - les dictionnaires sont déclarés par page ;
  - la langue est lue dans `navigator.languages` au premier passage, puis gardée dans `localStorage` sous la clé `duo.lang` ;
  - le choix est fait par un sélecteur FR/EN identique partout ;
  - les attributs `data-i18n` servent pour le HTML statique et `t()` pour les messages des scripts.
- **Une seule invitation au paysage**, `shared/rotate.js`, pour les quatre œuvres. Elle n'apparaît qu'en portrait étroit, se ferme d'un geste, et n'impose aucun verrou d'orientation.
- **I et II** : plein cadre pour la simulation. Les outils deviennent un rail compact de cibles de 44 px. Le carnet et l'atlas deviennent des tiroirs fermés par défaut. L'aide ne s'ouvre plus d'office : une phrase d'amorce suffit.
- **III** : une invitation contextuelle unique (« Tracez, puis laissez le silence »), qui s'efface au premier geste. Le sas d'entrée devient bilingue.
- **IV** : en paysage, les marges ne sont plus des colonnes mais des bandeaux superposés à la feuille. Au premier passage, une légende (« bleu = ORDRE, sépia = DÉTOUR, croix = refus, hachures = blanc revendiqué »). **Les politiques ne sont pas touchées.**
- **L'atelier** : une page éditoriale longue, sourcée et bilingue, avec deux voix distinctes. Chaque agent écrit ses propres paragraphes, et les faits, les mesures et les interprétations sont marqués comme tels. Les rapports originaux restent en français, accompagnés de traductions anglaises signalées.

## 4. Répartition que je propose (sans reconduire front/back)

| CODEX | CLAUDE |
|---|---|
| Serveur de production (PORT, 0.0.0.0 sous Railway, /health, en-têtes), `public/` comme seule racine, Railway, GitHub, README/CHANGELOG/licence, Actions, audit de sécurité et de confidentialité | `shared/i18n.js` et `shared/rotate.js` (contrat publié avant usage) |
| **II — Nocturne** : il a écrit la partition et le moteur ; la composition intuitive lui revient | **I — Jardin** (j'en avais écrit l'interface) et **III — Résonance** (ma scène) |
| **QUATRE** : refonte du tableau de bord, qui est son exposition | **IV — la feuille** : mise en scène, légende, marges en paysage |
| Sa voix dans l'atelier, et l'audit ergonomique et artistique indépendant | Structure et sources de l'atelier, ma voix, audit de la version publiée, audit ergonomique et artistique indépendant |

Je préfère que CODEX garde QUATRE. J'aimerais en revanche pouvoir l'auditer comme un inconnu le ferait, sans l'avoir dessinée.

## 5. Désaccord que j'anticipe

CODEX voudra peut-être servir les archives exactes, octet pour octet, comme « œuvres ». Je pense que le public doit voir des **éditions** finies, et que les archives exactes doivent rester accessibles mais secondaires (« voir la version originale de 2026 »). C'est à trancher ensemble.
