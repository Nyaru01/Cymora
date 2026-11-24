# PELAGIC V3 « Résonance » — rapport final de CLAUDE

*CLAUDE (Anthropic Claude Code), 2026-11-24, en binôme avec CODEX.*

## L'œuvre en une phrase

On laisse une trace dans une matière lumineuse, et le geste **chante** : plus haut, plus aigu. Des milliers de grains se rangent sur les lignes de repos d'une figure modale propre à cette note. Après une respiration de silence, la matière **répond** : les mêmes figures reviennent, le tracé réapparaît en or et une phrase apparentée se fait entendre. Chaque échange dépose une **rémanence** au fond, douze au plus. Laissée seule, la matière **rêve** de ces traces et appelle le passant suivant.

V1 (`v1.0.0`) et V2 (`v2.0.0`, `pelagic-v2`) sont intactes dans Git.

## Ce que nous avons retiré

V3 est **plus petite** que V2 : les sources de l'interface passent d'environ 4 200 à 2 000 lignes (`git diff --stat v2.0.0..HEAD -- src index.html` : +900 / −3 136).

Ont disparu de la surface : 7 outils, inspecteur, Atlas, Composer, frise et transport, carnet de bord, sonar, curseurs, lien de partage.

Il reste une scène et cinq gestes discrets : Son, Enregistrer, Garder l'empreinte, Effacer la mémoire, Aide.

## Désaccords réels et arbitrages (détail : docs/V3-DECISIONS.md)

| Sujet | Ma proposition | CODEX | Issue |
|---|---|---|---|
| Entrée | la **voix** chantée (micro) | geste seul | **J'ai concédé.** Une voix chantée ne peut pas être vérifiée réellement ici, et le brief l'exige. `pitch.js` et `listen.js` (YIN, < 0,1 Hz d'erreur en test) ont été retirés. Ils restent dans l'historique (7a984e8). |
| Mémoire | sédiment collectif de 64 figures | mémoire courte qui s'efface | 12 phrases, sédiment ténu, rêve au repos, empreinte personnelle |
| Coulisse « Atelier » | tolérée | refusée | **retirée** |
| Promesse scientifique | « cymatique réelle » | refus sans calibration | « inspirée des figures de Chladni », interprétation artistique assumée |

## Ma part hors de mon domaine historique : la physique

`src/cymatics.js` (le moteur était le domaine de CODEX) :
- **36 modes** (m, n) d'une plaque carrée, ordonnés par fréquence propre. La hauteur choisit le mode sur une échelle logarithmique de 82 à 880 Hz, et un glissando fait **morpher** une figure vers la suivante.
- Les particules dérivent selon **−ψ∇ψ** vers les lignes nodales, puis s'y allument. Le champ est **précalculé sur une grille de 128²** par mode : aucune trigonométrie par particule.
- `nodalSegments` extrait les lignes ψ = 0 (carrés marchants), qui dessinent la rémanence.
- **Correctif décisif trouvé au navigateur.** La famille antisymétrique (m − n impair) s'annule *toujours* sur la diagonale, si bien que chaque figure portait la même barre en travers. Je suis passé à la famille symétrique m − n pair, qui n'impose aucune ligne commune.

## Ma part dans mon domaine : la scène

`index.html`, `styles.css` et `app.js` sont réécrits :
- seuil « Laissez une trace. Puis écoutez. », avec ou sans son ;
- matière plein cadre, sans hublot gradué ;
- encre du geste qui s'efface, tracé d'or de la réponse ;
- dock qui n'apparaît qu'au mouvement ;
- rêve, attente respirante quand la mémoire est vide ;
- empreinte : glisser-déposer **ou** bouton dans l'Aide (audit CODEX) ;
- clavier complet : flèches et Espace maintenu ;
- allègement adaptatif sur le coût réel de calcul.

Le dialogue (`phrase.js`) et l'empreinte (`imprint.js`) de CODEX sont branchés **tels quels**, sans adaptateur.

## Vérifications réellement exécutées

- `npm test` : **49/49** en environ 4,5 s. La cymatique mesure environ 0,8 à 2 ms par pas pour 20 000 grains en Node, selon la charge, et la borne du test est volontairement large.
- Navigateur (WebGL2, 12 000 grains) :
  - pas avec figure : 0,71 ms ; moteur seul : 0,56 ms ; dessin : 1,08 ms ; travail moyen : environ 2,1 ms par pas ;
  - les 36 figures sont prêtes en tâche de fond.
- Parcours vérifiés :
  - geste souris : réponse **1,6 s après le dernier mouvement** (9 notes, 9 figures, tracé d'or), puis rémanence et stockage ;
  - clavier seul : réponse ;
  - empreinte relue par le dialogue de l'Aide : graine restaurée, Annuler proposé ;
  - 375 px sans débordement ;
  - aucune erreur de l'application en console.
- **Limites honnêtes :**
  - Le panneau d'aperçu était masqué et bridait l'horloge. J'ai donc vérifié la chronologie du dialogue en pilotant la simulation pas à pas, et non en temps réel.
  - Je n'ai pas entendu le son. La synthèse est celle de V2, déjà vérifiée à l'enregistrement par CODEX.
  - L'effet sur un public réel n'est pas mesurable ici.

## Audits croisés

- **Mon audit de `phrase.js` et `imprint.js`** : aucun défaut bloquant. Une suggestion artistique : le tracé de réponse n'est décalé que de ±0,045, une transformation trop discrète.
- **Audit de CODEX sur mon code**, entièrement traité :
  - test de coût rigide, devenu diagnostic ;
  - empreinte uniquement par glisser-déposer, d'où l'entrée fichier ajoutée ;
  - redimensionnement WebGL non protégé, désormais avec repli 2D.
- **Défauts trouvés dans mon propre code et corrigés :**
  - l'allègement adaptatif mesurait l'intervalle entre images, si bien qu'un écran bridé tombait à 3 797 grains ;
  - une mémoire illisible empêchait la scène de démarrer ;
  - `setPointerCapture` non protégé.
