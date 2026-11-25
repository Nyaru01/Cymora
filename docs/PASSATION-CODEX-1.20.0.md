# Passation de Codex à Claude — Cymora 1.20.0

25 novembre 2026 · branche `Resonance`

## Changements

- **Notes tenues, chapitre II.** Les consignes expliquent où se placer, quand attendre et quand reprendre ou relâcher. Le tutoriel permet de retrouver une note perdue sans lever le doigt. La jauge reste ancrée sur la note et l’anneau reste fermé brièvement à la réussite. L’ancienne barre horizontale a été retirée pour dégager la courbe. La durée de tenue reste de 1,3 seconde.
- **Chapitre V, Battre.** Deux temps de départ sonores et visuels conduisent à la réponse, y compris lors des reprises. Le repère de réponse se recale sur la première note jouée. Le retour indique la première note manquée ou l’intervalle le plus décalé, et souligne la perle correspondante. Le calcul du score conserve ses pondérations.
- **Herbier.** Une rosace ouvre une fiche qui permet d’écouter, d’arrêter ou de rejouer le chant. L’écoute commence par le motif de Cymora puis, s’il est disponible, par l’écho synthétisé du joueur. L’herbier garde le meilleur écho enregistré pour chaque chant accordé. Une ancienne rosace peut recevoir un écho lors d’un nouveau chant réussi, même sous son record historique. La lecture respecte le réglage Son.
- **Démarrage et accessibilité.** Le démarrage attend l’initialisation de l’état de l’intro. Les animations réduites et l’absence de vidéo donnent accès à l’accueil.

## Repères et compatibilité

- `public/src/app.js` contient les phases de jeu, le rendu des repères et la lecture de l’herbier. `public/src/game.js` contient le diagnostic rythmique et la lecture, la validation et l’écriture de la progression.
- Les échos utilisent `localStorage`, dans `cymora.progress.v1`, sous `echoes[chapitre][chant]`. Chaque entrée garde le score, 48 hauteurs et la durée du geste. Les anciennes sauvegardes restent lisibles et le marqueur de remise à zéro est conservé. Aucune donnée de l’herbier ne passe par l’API du chœur.
- La version `1.20.0` est alignée dans `package.json`, `package-lock.json`, `public/src/app.js` et `public/sw.js`.

## Vérifications et reprise

- Les 84 tests `npm test` passent et l’audit public ne remonte aucun signalement. Dans Edge en mode mobile émulé, les deux temps de départ, les trois retours de rythme, le rejeu, la persistance après rechargement et la lecture Web Audio du chant suivi de l’écho ont été vérifiés.
- Pour vérifier à la main, ouvrir le troisième chant du chapitre II, puis le premier chant du chapitre V. Dans l’herbier, ouvrir une ancienne rosace, rejouer son chant, le réussir, recharger et réécouter le chant suivi de l’écho.
- La compréhension sans aide par des joueurs qui découvrent Cymora, ainsi que l’écoute sur des téléphones physiques, restent à vérifier.
- Lors de ta prochaine publication, ajoute à ton tour une passation Markdown pour Codex dans `docs/` et référence-la dans `REPRISE.md`.
