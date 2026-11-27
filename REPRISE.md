# Reprendre Cymora — note de passation

> À lire en premier par toute personne (ou tout agent) qui reprend le projet sur une autre machine.
> Dernière livraison sur `Resonance` le 27 novembre 2026 — **1.27.0**. [Passation de Claude à Codex](docs/PASSATION-CLAUDE-1.27.0.md) · précédentes : [Claude, 1.26.0](docs/PASSATION-CLAUDE-1.26.0.md), [Claude, 1.25.0](docs/PASSATION-CLAUDE-1.25.0.md), [Claude, 1.24.2](docs/PASSATION-CLAUDE-1.24.2.md), [Claude, 1.22.6](docs/PASSATION-CLAUDE-1.22.6.md), [Codex, 1.20.0](docs/PASSATION-CODEX-1.20.0.md).

## En deux mots

**Cymora** (anciennement « Résonance ») est un jeu musical calme, en PWA. La matière (des grains de lumière sur une plaque circulaire, d'après les figures de Chladni) chante un court motif. Le joueur le retrace du doigt, plus haut pour plus aigu. Quand le geste épouse le chant, la matière se cristallise.

- **Parcours** — cinq chapitres de cinq chants (Voir, Suivre, Se souvenir, Écouter, Battre), une *résonance du jour* partagée (le chœur), une *improvisation* libre et un herbier des rosaces.
- **En ligne :** https://cymora.up.railway.app (Railway, projet `resonance`, services `resonance` et `Postgres`).
- **Code :** https://github.com/Nyaru01/Cymora, **branche `Resonance`** (et non `main`, qui contient l'ancien projet).
- **Langue :** tout le texte visible est en **français uniquement** (l'anglais a été retiré exprès).

## Récupérer et lancer

```powershell
git clone -b Resonance https://github.com/Nyaru01/Cymora.git cymora
cd cymora
npm ci
npm start            # http://127.0.0.1:4173 (variable PORT pour changer)
npm test             # node:test
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

Le service Railway est relié à `Resonance` pour le déploiement automatique. Utiliser la CLI ci-dessous si un déploiement manuel est nécessaire et autorisé.

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
- **Passation** — à chaque publication, l’agent qui livre ajoute un `.md` dans `docs/` pour l’autre agent et le référence ici. Y indiquer la version, les changements, les vérifications et les points ouverts. Cette règle vaut pour Claude et Codex.
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
| `public/vid/Intro.mp4` | vidéo d'intro mobile (10 s, portrait 720×1280, avec son) |
| `public/vid/intro_pc.mp4` | vidéo d'intro PC (10 s, 1280×720, bandes noires intégrées : affichée agrandie ×1,28) |

## Réglages de jeu décidés avec le propriétaire

- **Chapitres :** cinq (I Voir, II Suivre, III Se souvenir, IV Écouter, V Battre). Notes tenues dès le chapitre II (`tideHolds`), chapitre V en mesure (`pulseMotif`, `rhythmOf` mesuré contre `reachTimes`).
- **Tutoriels guidés :** avant la première note tenue (une note seule à tenir) et avant le chapitre V (quatre notes, une par battement). Clés `cymora.seen.hold` / `cymora.seen.pulse`.
- **Niveaux de perle :** unisson 85 %, résonance 95 %, parfait 97 % (`PERFECT`, exige toutes les tenues). **Herbier** : une rosace par chant accordé (`drawRosace`).
- **Lancement :** si le navigateur refuse le son, écran « Toucher pour entrer » puis intro avec le son ; fondu enchaîné de 3 s vers le fredonnement de l'accueil.
- **Pendant le tour :** pointillés du geste toujours visibles (demande du propriétaire, jeu relaxant) ; orbe lumineuse à la place du curseur sur PC.
- **Remise à zéro générale :** changer `RESET_EPOCH` dans app.js efface la progression de chaque appareil une fois. Faite le 25/11/2026.

- **Seuils :** 85 % pour avancer dans l'aventure (`PASS`), 90 % pour la résonance du jour et le chœur (`DAILY_PASS`), 95 % pour la « résonance » (`RESONANCE`). Entre 70 et 85 % (ou 90 % pour le jour), le verdict est « presque » : on rechante.
- **Tracé de Cymora par chapitre :** I toujours visible ; II visible pendant le chant ; III visible pendant le chant, il s'efface quand on répond ; IV un souffle de tracé pendant le chant. Le réglage « Garder le chant visible » le laisse affiché partout.
- **Lancement :** la vidéo d'intro, puis l'accueil (« Commencer » ou « Continuer »). Il n'y a plus de prologue.
  - L'écran reste noir tant que la vidéo n'a pas démarré.
  - Si le navigateur refuse le son, la vidéo part en muet avec un bouton « Activer le son ».
  - Sur PC, son reflet flou remplit les côtés.
- **Vocabulaire :** on dit « Chapitre », plus « Marée ». Le murmure de Cymora pendant son chant est « Écoute et regarde… ».
- **Inactivité :** en partie, « Je t'attends… » à 7 s, puis elle rechante à 16 s (deux fois au plus), puis elle fredonne de temps en temps. Sur l'accueil, au bout de 20 s, la phrase change et le logo pulse.

## Ce qui reste ouvert

- **Vibrations :** résolu (Android). Le réglage système coupait tout ; en jeu, les impulsions de moins de 50 ms ne se sentaient pas : elles font maintenant 50 ms au moins.
- **Atelier (prototypes) :** « Tenir » et « Pulsation », visibles **uniquement en local** (constante `LOCAL` dans app.js). Ne jamais les exposer en ligne.
- `public/vid/gemini_generated_video_eb89f13f.mp4` : une autre vidéo, non utilisée, non commitée et exclue du déploiement.

## Idées essayées puis abandonnées (ne pas reproposer telles quelles)

- Une voix fredonnée qui chante les notes, et une voix parlée (synthèse vocale) pour les murmures : abandonnées à la demande du propriétaire.
- Le clavier comme mode de jeu principal (« personne ne va jouer au clavier ») : il reste possible, mais il n'est plus annoncé.
- La coche ✓ de sauvegarde (jugée laide) : c'est maintenant l'étoile du score qui scintille.
- Le tracé en pointillés : remplacé par des perles reliées par une courbe douce.
