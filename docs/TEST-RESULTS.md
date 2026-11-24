# Résultats des vérifications — PELAGIC

Date : 24 novembre 2026. Agent : CODEX. Windows, Node.js 24.11.1.

Code de sortie npm test : 0

La commande utilise node:test avec une limite de 10 secondes par test. Aucun paquet externe.

```text

> pelagic@1.0.0 test
> node --test --test-timeout=10000

✔ chaque composition de l’Atlas est acceptée par le moteur (919.7728ms)
✔ chaque composition musicale fait chanter chacune de ses balises (6506.7675ms)
✔ les balises hautes sonnent plus aigu que les profondes (11.7913ms)
✔ pitchForDepth tolère les valeurs hors bornes (0.5331ms)
✔ noteName nomme la base et l’octave (4.9547ms)
✔ sans Web Audio, le moteur sonore se dégrade sans erreur (2.2542ms)
✔ same seed gives identical trajectories (440.8786ms)
✔ long simulation stays bounded and finite (1113.0812ms)
✔ pause delta does not move particles (7.6932ms)
✔ nodes change the flow and remain finite at their center (1.2621ms)
✔ export/import preserves composition and settings (4.6615ms)
✔ hostile and malformed imports are rejected (5.3452ms)
✔ population and node limits are enforced (0.6803ms)
✔ beacons leave velocity unchanged and survive export (2.4424ms)
✔ move and remove validate identity and coordinates (2.8299ms)
✔ reef size changes the physical deflection and zero strength has no force (0.954ms)
✔ loopback server serves modules and blocks private paths and mutations (4395.287ms)
✔ fitSquare centre un carré dans un canevas large (8.0642ms)
✔ screenToWorld convertit et rejette hors du carré (0.8637ms)
✔ nodeAt retourne le plus proche dans le rayon (3.1691ms)
✔ nudgeStrength respecte les bornes du moteur et évite zéro (3.7352ms)
✔ speedBucket est monotone et borné (2.8879ms)
✔ crossings ne compte que les entrées dans la zone (0.7722ms)
✔ base64url fait un aller-retour UTF-8 et refuse les caractères invalides (9.7923ms)
✔ formatTime et describeNode produisent un texte lisible (1.109ms)
ℹ tests 25
ℹ suites 0
ℹ pass 25
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 8501.1208
```

## Couverture et contrôles complémentaires

- **25 tests automatisés, 25 réussis**, code de sortie 0 : moteur 10, serveur 1, interface 8, audio 4, Atlas 2. Dernier passage : 8,50 secondes.
- Une première tentative de capture de sortie a rencontré `spawn EPERM` dans le bac à sable. La même commande, autorisée avec sous-processus, a donné le résultat ci-dessus. Aucun contournement du bac à sable.
- Atlas : chaque balise des compositions musicales est traversée pendant les 1200 pas de 0,05 seconde du test, avec la vitesse propre à la composition. Il s'agit de passages calculés ; le test ne juge pas le son à l'oreille.
- Régression finale récifs : augmenter Taille augmente la déviation calculée ; une force nulle n'exerce aucune déviation ; le champ reste fini au centre.

## Navigateur — observations directes CODEX

Navigateur intégré, 24 novembre 2026 :

| Vérification | Résultat observé |
|---|---|
| Bureau 1440 × 1000 | Océan rendu, contrôles visibles, aucune erreur console |
| Ajout au clavier | Tourbillon et balise créés ; compteur de 3 à 5 éléments |
| Audio et pause | États « Son actif » et « Reprendre » visibles après action |
| Atlas Gyre | Population 2200, vitesse 1,4 et turbulence 0,25 appliquées |
| Annuler / Rétablir | Retour aux réglages 1800 / 1 / 0,45 puis retour au Gyre |
| Immersion | Entrée et sortie via boutons confirmées |
| Mobile 375 × 812 | Largeur document 360 pour un viewport 375 (barre verticale), scène 402 px, hublot 328 px, aucun débordement horizontal |
| Tablette 768 × 1024 | Largeur document 753, scène 795 px, aucun débordement horizontal |
| Paysage 812 × 375 | Largeur document 797, scène 366,5 px, canevas 290,5 px |
| Sauvegarde locale | Message de restauration et composition précédente visibles après réouverture |
| Console révision Atlas/historique | Aucune erreur ni avertissement capturé |

Le premier contrôle mobile avait trouvé un débordement réel ; la vérification ci-dessus porte sur la correction de CLAUDE. Le viewport temporaire de test a été réinitialisé ensuite.

## Windows et serveur

CODEX a exécuté START puis STOP, vérifié la détection d'une instance déjà lancée et le second STOP sans effet. Les deux scripts passent le parseur PowerShell et portent un BOM UTF-8. STOP attend la fermeture de son processus et retire le marqueur temporaire. L'absence d'écouteur TCP est vérifiée séparément ; une requête HTTP de sondage après arrêt avait expiré à deux secondes, ce qui n'est pas utilisé seul comme preuve de fermeture.

Le test serveur couvre tous les modules publics, HEAD, Content Security Policy, refus des fichiers privés et des mutations, refus de l'arrêt sans jeton ou avec un jeton invalide, puis arrêt authentifié avec code de processus 0.

## Vérifications déclarées par CLAUDE et limites

Le rapport indépendant `docs/CLAUDE-FINAL.md` décrit ses essais d'édition tactile/souris, inspecteur, partage/import aller-retour, Blob PNG et historique. Ces essais ne sont pas tous répétés par CODEX.

La copie de lien a affiché un succès dans l'interface, mais la lecture du presse-papiers CUA a renvoyé une chaîne vide ; CODEX ne certifie donc pas lui-même le transfert du presse-papiers. L'aller-retour du lien est déclaré par CLAUDE. Aucun des agents n'a évalué la qualité auditive ni le téléchargement final dans un dossier utilisateur. Aucun audit complet au lecteur d'écran ou sur téléphone physique n'a été réalisé.
