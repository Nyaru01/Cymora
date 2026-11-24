# Public-edition readiness

CODEX · 24 novembre 2026 · état de préparation, pas une revendication d’URL Railway

## Contrôles déjà exécutés

- Suite locale : 77 tests réussis, aucun échec lors du premier passage complet V (4,77 s).
- Serveur lancé dans une copie isolée sans .git : quatre routes, ressources communes, /health, méthodes, blocage privé, redirection et ETag vérifiés.
- Aucune modification des politiques ni de l’arène IV ; tests de comparaison et rencontre de graine 8 conservés.
- Scan de public/ : aucune correspondance pour secrets reconnus, chemins personnels, emails, capture micro/caméra ou traceurs usuels.
- Nocturne : note ajoutée au clavier, quatre mouvements, atelier EN, JSON, PNG et audio WebM réellement téléchargés.
- Jardin : Atlas Le Gyre chargé, anglais et métriques observés. Ce parcours a révélé un débordement après message long, en correction.
- Résonance : entrée en silence, geste clavier, rémanence en anglais observée.
- Intervalle : marges anglaises, graine 8, pause et fin naturelle observées.
- Atelier : douze chapitres, voix séparées chargées. Rapports FR/EN des deux auteurs chargés sans erreur console.

## Matrice et preuves

Les dix dimensions CSS demandées ont été parcourues sur QUATRE et les quatre œuvres. Les captures et relevés sont conservés dans .runtime/qa/g5-captures/ sur le poste, puis les principales preuves finales seront sélectionnées pour la documentation publique. Premier passage : Résonance et Intervalle sans débordement aux dix tailles ; Nocturne Composer sans débordement ; Jardin avec description Atlas longue déborde en paysage ; QUATRE a nécessité une correction de hauteur à 667×375.

Ces captures utilisent un navigateur de bureau et ne représentent pas des essais sur téléphones physiques. Un changement d’orientation est vérifié par redimensionnement, sans verrou d’orientation. Aucun audit complet avec lecteur d’écran ni observation de visiteurs réels.

## Mesures distinctes

Les mesures du moteur historique, des appels de dessin et de mise en page ne sont pas confondues. Le mode audit de Nocturne affiche simulation et dessin séparément dans le navigateur. Un débit de calcul Node ou la taille CSS d’une scène ne garantit pas une cadence GPU sur un téléphone.

## Publication et blocages externes

Le dépôt cible est public et a été vérifié vide avant préparation. L’historique local contient des journaux privés et une métadonnée personnelle ; un historique public séparé est préparé, sans réécrire l’original. La vérification finale du distant et les résultats d’Actions seront ajoutés après publication effective.

Railway : CLI authentifiée, aucun projet/environnement lié ni service créé. Configuration et étapes exactes sont dans G5-DEPLOYMENT.md. Aucune URL Railway n’est revendiquée. Aucun test HTTPS des exports n’est revendiqué tant qu’un déploiement réel n’existe pas.

## Résolution des derniers défauts observés

Le Jardin a été retesté après chargement de la longue description du Gyre aux tailles 667×375, 844×390, 915×412 et 932×430 : la largeur et la hauteur du corps correspondent exactement au viewport. Les six outils ont des noms accessibles anglais/français ; le carnet fermé est inerte. QUATRE à 667×375 : les quatre salles mesurent 260 px de haut, sans défilement interne nécessaire après correction.

Nocturne : tous les boutons principaux contrôlés à 667×375 font 44 px de haut. La partition a avancé de mesure 1 à mesure 5 pendant le test ; changement de langue en cours de lecture vérifié. Noms de notes en notation anglaise corrigés. Le repli Canvas forcé a réellement dessiné la scène. Mesures navigateur, moyennes sur 120 images : WebGL2, 3 500 grains, simulation 0,44 ms et appels de dessin 0,49 ms ; Canvas 2D, 7 000 grains après un passage de 4K au paysage, simulation 0,73 ms et dessin 0,76 ms. Ces appels ne mesurent pas l’intégralité du travail GPU/compositeur.

Captures publiques sélectionnées : docs/captures/g5-codex/ (réduites pour le dépôt) et docs/captures/g5-claude/. Les captures intégrales restent dans .runtime/qa/g5-captures/. Aucun moteur ni algorithme n’est accéléré artificiellement pour ces captures.

Exports Nocturne réels de cette édition : JSON 8 605 octets, PNG 847 984 octets, WebM 381 139 octets, rangés dans .runtime/qa/. Les tailles dépendent de cet état de test, pas d’une promesse de taille fixe.
