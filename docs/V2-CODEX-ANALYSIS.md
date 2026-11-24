# PELAGIC V2 — analyse indépendante CODEX

24 novembre 2026, analyse commencée à 14:09 (Paris), avant lecture d'une analyse V2 de CLAUDE.

## Ce que V1 réussit

Une métaphore cohérente, un moteur testable indépendant du DOM, un rendu sans ressources externes et un instrument compréhensible à la souris comme au clavier. Le son est issu de phénomènes visibles ; il ne s'agit pas d'une bande-son plaquée sur une animation.

## Faiblesses observées dans les sources

1. L'océan est composé dans l'espace, mais jamais dans le temps : les balises restent fixes et les presets sont des points de départ sans récit. On regarde un état, on ne dirige pas une œuvre.
2. Le rythme dépend exclusivement du passage fortuit de particules. Il manque une intention musicale et une façon de développer tension, silence et reprise.
3. L'interface accumule de nombreuses cartes de réglages. L'océan est beau mais l'entrée dans le produit ressemble encore à un panneau technique.
4. La sauvegarde conserve une composition mais pas une performance structurée. On ne peut pas transmettre une évolution ou retrouver un passage d'une pièce.
5. app.js dépasse 1300 lignes et concentre état, historique, Canvas, interactions et persistance. Toute nouvelle ambition doit isoler les nouveaux systèmes plutôt que prolonger ce bloc indéfiniment.
6. La simulation dépend des pas de temps du rendu. Le déterminisme testé est valable à pas égaux, pas une garantie de film reproductible entre machines. Ne pas promettre une capture exacte de performance sans système adapté.

## Potentiel : une partition vivante

Passer du jardin statique à un instrument de mise en scène des courants : plusieurs mouvements dans une boucle, interpolation des éléments entre tableaux, transport et exploration temporelle, balises au timbre et à la palette plus intentionnels. Les courants deviennent la partition, le plancton l'interprète.

Proposition à confronter : quatre mouvements nommés et éditables dans une durée choisie. Capturer une composition dans un mouvement, en sculpter un autre, jouer les transitions et conserver/exporter la pièce entière. Le passage V1→V2 doit accepter les anciens JSON et préserver la V1 dans Git.

## Risques à résoudre avant implémentation

- Ne pas multiplier les commandes : distinguer exploration libre et composition dans le temps.
- L'édition ne doit pas lutter contre l'interpolation ; capturer/éditer un mouvement doit avoir une sémantique claire.
- Identité stable des éléments entre mouvements, apparition/disparition progressive et suppression sans saut.
- Les exports décrivent une partition ; le résultat des particules n'est pas une vidéo déterministe.
- Maintenir localhost, absence de dépendances payantes et démarrage Windows simple.

## Contribution que CODEX peut porter

Module de partition pur, validation/versionnement/import V1, interpolation et tests de transport ; évolutions du moteur convenues, serveur et contrôles de régression. CLAUDE reste libre de challenger le concept et de proposer une autre répartition.
