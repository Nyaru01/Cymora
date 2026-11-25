# Résonance

**La matière chante. Réponds-lui.** · *The matter sings. Answer it.*

Résonance est un jeu musical apaisé, installable comme une app sur téléphone, tablette et ordinateur. Une matière lumineuse chante un court motif ; on lui répond en le retraçant du doigt : plus haut, plus aigu. Quand le geste épouse le chant, la matière entre en résonance et se cristallise en une figure de Chladni.

Cette branche (`Resonance`) fait de l'œuvre III de l'exposition QUATRE une application à part entière. L'exposition complète reste sur `main`.

## Ce qu'on y fait

- **Quatre marées**, de cinq chants chacune, pour apprendre à entendre :
  1. *Voir* — le tracé du chant reste visible ;
  2. *Suivre* — il s'efface dès qu'on répond ;
  3. *Se souvenir* — à peine une esquisse ;
  4. *Écouter* — plus de tracé : le son, et la forme de la matière.
- **La résonance du jour** : le même chant pour tout le monde, chaque jour, avec une série de jours consécutifs.
- **Improviser** : le dialogue libre de la version d'exposition. On trace, on se tait, elle répond.

Aucun échec ni chronomètre : une réponse trop éloignée fait rechanter la matière, plus lentement. Après deux essais, elle montre le chemin.

## Principes

- Gratuit, sans compte, sans publicité ni mesure d'audience. La progression reste sur l'appareil (`localStorage`).
- Le son ne démarre qu'après un geste volontaire. Aucun micro, aucune caméra.
- Tout fonctionne hors ligne une fois l'app chargée en HTTPS (service worker).
- Aucune dépendance : modules ES natifs, Web Audio, WebGL2 avec repli Canvas 2D.

## Lancer

Node.js 22 ou plus récent, rien à installer.

```powershell
node server.mjs
```

Puis ouvrir http://127.0.0.1:4173/. Tests : `npm test`. Audit des fichiers publics : `npm run audit:public`.

## Déploiement (Railway)

`railway.json` et le `Dockerfile` construisent une image Node 22 qui ne contient que `server.mjs` et `public/`. Le serveur écoute sur `0.0.0.0:$PORT` sous Railway (sur la boucle locale sinon) et expose `/health`.

## Architecture

| Fichier | Rôle |
|---|---|
| `public/src/game.js` | motifs, mesure de l'accord (DTW sur le contour mélodique), marées, progression |
| `public/src/app.js` | la scène : chant, réponse, écho, interface |
| `public/src/cymatics.js` | figures de Chladni : la note devient une forme |
| `public/src/engine.js`, `render.js` | matière (particules) et rendu WebGL2 / Canvas 2D |
| `public/src/audio.js` | synthèse Web Audio, bourdon, accords |
| `public/src/phrase.js` | dialogue libre (mode Improviser) |
| `server.mjs` | serveur statique sans dépendance, CSP stricte, `/health` |

Créé par CODEX et CLAUDE dans le projet QUATRE, puis développé en application.
