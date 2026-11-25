# Reprendre Cymora — note de passation

> À lire en premier par toute personne (ou tout agent) qui reprend le projet sur une autre machine.
> État au 25 novembre 2026 : **version 1.6.1**, en ligne et identique à la branche GitHub `Resonance`.

## En deux mots

**Cymora** (anciennement « Résonance ») est un jeu musical calme, en PWA. La matière (des grains de lumière sur une plaque circulaire, d'après les figures de Chladni) chante un court motif. Le joueur le retrace du doigt, plus haut pour plus aigu. Quand le geste épouse le chant, la matière se cristallise.

- **Parcours :** 4 chapitres de 5 chants (Voir, Suivre, Se souvenir, Écouter), une *résonance du jour* partagée (le chœur) et une *improvisation* libre.
- **En ligne :** https://cymora.up.railway.app (Railway, projet `resonance`, services `resonance` et `Postgres`).
- **Code :** https://github.com/Nyaru01/Duo, **branche `Resonance`** (et non `main`, qui contient l'ancien projet).
- **Langue :** tout le texte visible est en **français uniquement** (l'anglais a été retiré exprès).

## Récupérer et lancer

```powershell
git clone -b Resonance https://github.com/Nyaru01/Duo.git cymora
cd cymora
npm ci
npm start            # http://127.0.0.1:4173 (variable PORT pour changer)
npm test             # node:test, 75 tests, doivent tous passer
npm run audit:public # aucun secret ni donnée perso dans ce qui est publié
```

- Prérequis : **Node 22 ou plus**. Sans `DATABASE_URL`, le chœur fonctionne en mémoire, ce qui suffit en local.
- **Aperçu Claude Code** (le dossier `.claude/` est ignoré par git, à recréer) dans `.claude/launch.json` :
  ```json
  { "version": "0.0.1", "configurations": [ { "name": "resonance", "runtimeExecutable": "node", "runtimeArgs": ["server.mjs"], "port": 4180, "env": { "PORT": "4180" } } ] }
  ```
- Ajouter `?debug` à l'URL expose `globalThis.__cymora`, avec `tick(n)` pour avancer de n pas de simulation et `draw()` pour dessiner. Le volet d'aperçu bride l'animation à environ 2 images par seconde : il faut passer par `tick`.
- Le serveur inventorie `public/` **au démarrage**. Après l'ajout d'un fichier, il faut redémarrer le serveur.

## Déployer

```powershell
railway login
railway link          # projet « resonance », service « resonance »
railway up --ci --service resonance
```

- Vérifier ensuite `https://cymora.up.railway.app/health` (doit renvoyer `{"status":"ok","app":"cymora"}`) et la ligne `VERSION` de `/sw.js`.
- `DATABASE_URL` est une **référence Railway** (`${{Postgres.DATABASE_URL}}`). Ne jamais lire, copier ni afficher d'identifiants.

## Règles de la maison (à respecter)

- **Version :** à chaque livraison, augmenter la même version à **trois endroits** : `package.json` (puis `npm install --package-lock-only`), `public/sw.js` et `public/src/app.js` (`const VERSION`). Un test le vérifie. C'est ce changement de version qui déclenche le pop-up « mise à jour » chez les joueurs.
- **Commits :** utiliser l'identité neutre, jamais d'e-mail personnel dans l'historique public.
  ```powershell
  $env:GIT_AUTHOR_NAME="QUATRE — CODEX & CLAUDE"; $env:GIT_COMMITTER_NAME=$env:GIT_AUTHOR_NAME
  $env:GIT_AUTHOR_EMAIL="quatre-agents@users.noreply.github.com"; $env:GIT_COMMITTER_EMAIL=$env:GIT_AUTHOR_EMAIL
  ```
- **Git :** ne jamais faire de `force push` ni de `reset --hard`. Pousser (`git push origin HEAD:Resonance`) **seulement quand le propriétaire le demande**. On peut déployer sur Railway pour lui montrer.
- **Sécurité :** la CSP est stricte, donc pas de style ni de script en ligne dans le HTML (fixer un style depuis JS est permis). Pas de dépendance externe côté client.

## Où est quoi

| Fichier | Rôle |
|---|---|
| `server.mjs` | serveur statique (CSP, ETag, plages d'octets pour la vidéo mp4), `/health`, API du chœur `/api/day/AAAA-MM-JJ` |
| `chorus.mjs` | chœur du jour : Postgres via `pg`, repli en mémoire ; le serveur re-note chaque tracé |
| `public/src/game.js` | motifs, mesure de l'accord (DTW), chapitres (`TIDES`), seuils, progression, score de résonance |
| `public/src/app.js` | classe `Cymora` : intro vidéo, accueil, phases `call`, `turn`, `echo`…, menu et réglages, vibrations, inactivité, dessin du chant (encre 2D) |
| `public/src/cymatics.js` | modes de Bessel sur plaque circulaire, champs et dérive des grains |
| `public/src/render.js` | rendu WebGL2 des grains (palette néon, halo, fondu au bord) |
| `public/src/strings.js` | **tous les textes** (français) |
| `public/src/styles.css` | direction artistique, mise en page mobile et grand écran |
| `public/sw.js` | hors ligne : un cache par version ; `/api/` et `/vid/` ne passent pas par le cache |
| `public/img/` | découpes de la planche d'assets (fonds des chapitres, rosaces, fleur) ; la planche d'origine y reste mais n'est pas publiée |
| `public/vid/Intro.mp4` | vidéo d'intro (10 s, portrait 720×1280, avec son) |

## Réglages de jeu décidés avec le propriétaire

- **Seuils :** 85 % pour avancer dans l'aventure (`PASS`), 90 % pour la résonance du jour et le chœur (`DAILY_PASS`), 95 % pour la « résonance » (`RESONANCE`). Entre 70 et 85 % (ou 90 % pour le jour), le verdict est « presque » : on rechante.
- **Tracé de Cymora par chapitre :** I toujours visible ; II visible pendant le chant ; III visible pendant le chant, il s'efface quand on répond ; IV un souffle de tracé pendant le chant. Le réglage « Garder le chant visible » le laisse affiché partout.
- **Lancement :** la vidéo d'intro, puis l'accueil (« Commencer » ou « Continuer »). Il n'y a plus de prologue.
  - L'écran reste noir tant que la vidéo n'a pas démarré.
  - Si le navigateur refuse le son, la vidéo part en muet avec un bouton « Activer le son ».
  - Sur PC, son reflet flou remplit les côtés.
- **Vocabulaire :** on dit « Chapitre », plus « Marée ». Le murmure de Cymora pendant son chant est « Écoute et regarde… ».
- **Inactivité :** en partie, « Je t'attends… » à 7 s, puis elle rechante à 16 s (deux fois au plus), puis elle fredonne de temps en temps. Sur l'accueil, au bout de 20 s, la phrase change et le logo pulse.

## Ce qui reste ouvert

- **Vibrations :** le propriétaire n'en ressent toujours aucune sur son téléphone. On ne sait pas encore s'il s'agit d'un iPhone (Safari ne fait jamais vibrer depuis une page web ; seul un « tic » est tenté sur iOS 18 et plus) ou d'un Android (le menu affiche alors si le navigateur a accepté ou refusé). **Première question à lui poser.**
- `public/vid/gemini_generated_video_eb89f13f.mp4` : une autre vidéo, non utilisée, non commitée et exclue du déploiement.

## Idées essayées puis abandonnées (ne pas reproposer telles quelles)

- Une voix fredonnée qui chante les notes, et une voix parlée (synthèse vocale) pour les murmures : abandonnées à la demande du propriétaire.
- Le clavier comme mode de jeu principal (« personne ne va jouer au clavier ») : il reste possible, mais il n'est plus annoncé.
- La coche ✓ de sauvegarde (jugée laide) : c'est maintenant l'étoile du score qui scintille.
- Le tracé en pointillés : remplacé par des perles reliées par une courbe douce.
