# Passation de Claude à Codex — Cymora 1.27.0

27 novembre 2026 · branche `Resonance` · suite de [la 1.26.0](PASSATION-CLAUDE-1.26.0.md)

## Changements

- **Silence en arrière-plan (`app.js` et `audio.js`).**
  - **La mise en veille :** `audio.sleep()` suspend tout le contexte audio, sans toucher au réglage du son, et `audio.wake()` le relance.
  - **Quand ça se déclenche :** au `visibilitychange`, au `pagehide` et au `pageshow` (persisted). Les vidéos sonores sont mises en pause, puis reprises au retour.
  - **Le premier toucher :** il réveille aussi le son, pour les téléphones qui refusent de le relancer sans geste.
- **Le manifeste sur l'accueil.** Le lien « Manifeste » (`#go-manifesto`) ouvre la fenêtre `#manifesto`, qui contient cinq lignes (`manifesto.1` à `manifesto.5`) et le formulaire « Laisse-lui un mot ».
- **Les mots des joueurs, enregistrés en base.**
  - **L'adresse :** `POST /api/words`, avec un corps JSON `{text, sign, version, site}`.
  - **Le contrôle :** il est fait par `cleanWord`, dans `chorus.mjs`.
    - le texte fait de 3 à 600 caractères, sans caractères de contrôle ;
    - la signature fait 40 caractères au plus ;
    - le champ `site` est un piège à robots, invisible : s'il est rempli, le mot est refusé (400).
  - **Les refus :** une autre origine donne une erreur 403. Au-delà de quatre mots par heure et par visiteur, c'est une erreur 429 (la limite est gardée en mémoire seulement).
  - **Le stockage :** Postgres, table `words` (`id`, `text`, `sign`, `version`, `created`), créée au démarrage. Ni adresse ni identifiant n'est gardé. Sans `DATABASE_URL`, les mots restent en mémoire.
  - **La lecture :** aucune route ne relit les mots, qui ne sont jamais affichés. On les lit dans la base Railway, par exemple : `SELECT created, sign, text FROM words ORDER BY created DESC;`.

## Vérifications

- Les tests passent, dont ceux de `/api/words` dans `tests/server.test.js`, et l'audit public est propre.
- **Dans l'aperçu :** le manifeste s'ouvre, un mot s'envoie (« Merci. Ton mot est bien arrivé. »), un mot trop court est refusé, et l'affichage tient sur mobile.
- **Pas vérifié :** la coupure du son sur un vrai téléphone en arrière-plan, et l'écriture réelle dans le Postgres de Railway.
