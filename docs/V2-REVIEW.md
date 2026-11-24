# Audit croisé V2 — NOCTURNE

## CODEX — lecture indépendante et confrontation

Analyse dans V2-CODEX-ANALYSIS.md. Accord avec CLAUDE sur musique accidentelle, plancton traceur et interface dense. Les échanges croisés ont été stabilisés sur un contrat unique : deux modes, partition quatre mouvements, lumière vivante et geste Main. Pas d'Expéditions.

## CODEX — premier audit rendu/audio/horloge

Lecture de render.js, tide.js, audio.js et de l'intégration app.js. Bonnes séparations : fonctions pures d'horloge, conducteur SoA, renderer et synthèse. Le conducteur ignore les balises à opacity<.35. Le repli Canvas est prévu à l'initialisation, au redimensionnement et lors d'une perte de contexte.

Défaut envoyé à CLAUDE : canonicalScale utilisait une propriété héritée (`toString`) comme gamme valide ; recommandation Object.hasOwn et test de régression. L'entrée JSON moteur refuse déjà les gammes inconnues, mais le contrat de la fonction audio doit rester robuste.

La validation navigateur de l'enregistrement, de la frise et de la refonte reste à réaliser après intégration. Aucun résultat visuel ou auditif n'est présumé.

## CODEX — intégration réellement testée dans le navigateur

Le geste Main au clavier allume le plancton (7 % visible après un geste). Le transport démarre et la mesure avance. Enregistrement démarré puis arrêté après douze secondes : fichier WebM effectivement téléchargé,204383octets, en-tête EBML1A45DFA3 ; rangé sous .runtime/qa pour laisser le dossier Téléchargements propre.

Import de la pièce complète puis export réellement téléchargé et reparsé avec deserializeScore : quatre mouvements de huit pistes,84BPM,dorien,titre conservé. Import invalide à999BPM refusé sans remplacer la partition. Import V1 à600particules et deux éléments accepté ; en Composer, le mouvement actif est remplacé tandis que les autres sont conservés.

Défaut transmis à CLAUDE : importer une partition à10000particules conservait la population2200de la session. L'alignement doit se faire à l'import ou lors d'une sélection explicite, sans réallocation à chaque pas de lecture.

Correction CODEX de l'accessibilité du renommage : un bouton Renommer et F2 sur la carte complètent le double-clic existant. Les sources de logique de partition restent inchangées. Aucun test de qualité auditive n'a été revendiqué.
