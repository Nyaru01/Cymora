# Cymora

**La matière chante. Réponds-lui.** · *The matter sings. Answer it.*

Cymora est un jeu musical apaisé, installable comme une app (PWA) sur téléphone, tablette et ordinateur. Une matière lumineuse chante un court motif ; on lui répond en le retraçant du doigt : plus haut, plus aigu. Quand le geste épouse le chant, la matière entre en résonance et se cristallise en une figure de plaque vibrante : rosaces, pétales, anneaux.

Cette branche (`Resonance`) fait de l'œuvre III de l'exposition QUATRE, *Résonance*, une application à part entière : Cymora. L'exposition complète reste sur `main`. Adresse : https://cymora.up.railway.app

## Ce qu'on y fait

- **Quatre marées**, de cinq chants chacune, pour apprendre à entendre :
  1. *Voir* — le tracé du chant reste visible ;
  2. *Suivre* — il s'efface dès qu'on répond ;
  3. *Se souvenir* — à peine une esquisse ;
  4. *Écouter* — plus de tracé : le son, et la forme de la matière.
- **La résonance du jour** : le même chant pour tout le monde, chaque jour, avec une série de jours consécutifs. Quand tu l'accordes, ta trace rejoint **le chœur du jour**, et tu vois en filigrane comment les autres l'ont chanté.
- **Improviser** : le dialogue libre de la version d'exposition. On trace, on se tait, elle répond.

Aucun échec ni chronomètre : une réponse trop éloignée fait rechanter la matière, plus lentement. Après deux essais, elle montre le chemin.

## Principes

- Gratuit, sans compte, sans publicité ni mesure d'audience. La progression reste sur l'appareil (`localStorage`).
- Le chœur ne garde que des courbes anonymes : 48 hauteurs et une durée par voix, re-mesurées par le serveur, effacées après 45 jours. Ni adresse IP, ni identifiant, ni cookie.
- Le son ne démarre qu'après un geste volontaire. Aucun micro, aucune caméra.
- Tout fonctionne hors ligne une fois l'app chargée en HTTPS (service worker).
- Côté navigateur, aucune dépendance : modules ES natifs, Web Audio, WebGL2 avec repli Canvas 2D. Côté serveur, une seule : `pg`, pour le chœur.

## Lancer

Node.js 22 ou plus récent.

```powershell
npm install
node server.mjs
```

Sans `DATABASE_URL`, le chœur vit dans la mémoire du serveur : rien d'autre à installer en local.

Puis ouvrir http://127.0.0.1:4173/. Tests : `npm test`. Audit des fichiers publics : `npm run audit:public`.

## Déploiement (Railway)

`railway.json` et le `Dockerfile` construisent une image Node 22 qui ne contient que `server.mjs`, `chorus.mjs`, `pg` et `public/`. Le serveur écoute sur `0.0.0.0:$PORT` sous Railway (sur la boucle locale sinon) et expose `/health`. Le service Postgres de Railway fournit `DATABASE_URL` ; la table `chorus` se crée au démarrage.

## Architecture

| Fichier | Rôle |
|---|---|
| `public/src/game.js` | motifs, mesure de l'accord (DTW sur le contour mélodique), marées, progression |
| `public/src/app.js` | la scène : chant, réponse, écho, interface |
| `public/src/cymatics.js` | plaque circulaire (modes de Bessel) : la note devient une rosace |
| `public/src/engine.js`, `render.js` | matière (particules) et rendu WebGL2 / Canvas 2D |
| `public/src/audio.js` | synthèse Web Audio, bourdon, accords |
| `public/src/phrase.js` | dialogue libre (mode Improviser) |
| `server.mjs` | serveur statique, CSP stricte, `/health`, `/api/day/AAAA-MM-JJ` |
| `chorus.mjs` | chœur du jour : validation, re-mesure, stockage Postgres ou mémoire |
| `assets/source/` | images d'origine de l'emblème (non servies) |

Créé par CODEX et CLAUDE dans le projet QUATRE, puis développé en application.
