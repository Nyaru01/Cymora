# Génération IV — vérification de livraison

CODEX · 24 novembre 2026

## Git et serveur

V1 1e66482, V2 4eb10f3, V3 b566fb3 : commits figés, tags originaux inchangés. Serveur exclusivement sur 127.0.0.1. Un git archive par version, parsing TAR en mémoire, filtre de fichiers publics, aucune extraction disque. Les pages servies sont comparées octet par octet à git show. L’option -c core.autocrlf=false ne change aucune configuration du poste.

Chemins privés et mutations bloqués ; HEAD et arrêt par jeton conservés. CSP par SHA-256 pour le HTML autonome, sans unsafe-inline. Les fins de ligne sont normalisées comme le parseur HTML avant calcul ; régression dédiée. START attend HTTP avant d’annoncer prêt ; STOP vérifie l’identité du processus.

## Parcours navigateur observés

- Exposition : salles I à IV au clavier, cartels et fermeture Échap, focus sur Fermer ; pause des études ; bureau 1440×900 et mobile 390×844.
- À 390 px : corps, galerie et chaque salle mesurent 390 px, aucune salle en débordement horizontal interne ; défilement vertical possible.
- V1 : Atlas Le Gyre chargé, paramètres et métriques actualisés.
- V2 : Explorer → Composer, quatre mouvements visibles.
- V3 : seuil → Entrer en silence → scène et commandes.
- INTERVALLE : pause, reprise, fin naturelle, nouvelle rencontre depuis une pause et remise à zéro des compteurs ; graine 8 conforme au relevé initial.
- SVG téléchargé par la vraie commande : 15 027 octets pour la feuille suspendue, XML valide, fichier rangé dans .runtime/qa.
- Aucune erreur d’application dans les consoles consultées.

CLAUDE a audité la galerie indépendamment à 1440×900 et 375×812. Son rapport garde les limites observées à son propre instant de test, avant les derniers correctifs CODEX.

## Mesures

Diagnostic visible EXPOSITION.html?audit, 120 dessins par échantillon, viewport 1440×900, Canvas affiché 589×542 pixels, résolution plafonnée à 1,75× :

| Étude | Moyenne JS/dessin | p95 |
|---|---:|---:|
| I — Courant | 0,94 ms | 1,20 ms |
| IV — Deux écritures | 0,28 ms | 0,40 ms |

Les appels Canvas sont inclus ; ce n’est pas une mesure complète du GPU ni une garantie de cadence. Seule la salle active est animée. CLAUDE a calculé huit rencontres pures en 2–7 ms ; le rythme de l’œuvre dépend du rafraîchissement, sans promesse de durée exacte.

## Corrections et limites

Mouvement réduit : même chemin d’annotation que l’animation. Frise validée et message vide de largeur naturelle. Notes SVG chronologiques. Saut refusé annulé au lieu d’être répété indéfiniment. Nouvelle rencontre sans pause résiduelle. Tours cédés séparés par politique, aucun gagnant.

Le navigateur automatisé interdit file:// ; l’ouverture directe n’a pas été observée et la restriction n’a pas été contournée. Le document contient ses CSS/JS et utilise les polices système. Le dialogue explicatif hors serveur existe dans le code, mais n’a pas été actionné sous file://. Aucun visiteur réel, audit complet de lecteur d’écran ou comparaison multi-GPU. Les anciens stockages locaux peuvent être partagés entre archives d’une même origine, conformément au code historique.

Fixtures, exports et journaux temporaires sont rangés dans .runtime, ignoré par Git. Aucun nettoyage global du poste ni changement de configuration Windows.

Suite finale : npm test — 65 tests réussis, 0 échec (7,16 s). git diff --check sans erreur. Serveur 4173 arrêté par STOP.ps1 après QA.
