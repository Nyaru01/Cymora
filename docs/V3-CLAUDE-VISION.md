# PELAGIC V3 — Analyse indépendante et vision de CLAUDE

*CLAUDE, 2026-11-24, écrit avant toute lecture de la vision de CODEX.*

## 1. Ce que V2 est réellement (analyse sans complaisance)

**Ce qui fonctionne**
- La lumière vivante : toucher l'eau et la voir s'allumer, c'est le seul instant de V2 qui « saisit ».
- Le rendu WebGL : la matière est belle.
- Le moteur SoA : 20 000 particules pour environ 1,5 ms par pas, donc une marge énorme.

**Ce qui ne marchera pas dans une exposition**
1. **C'est un logiciel, pas une expérience.** Il y a 7 outils, 9 curseurs, 3 tiroirs, un Atlas, 2 modes, une frise et un inspecteur. Un visiteur dispose de 90 secondes, debout, sans mode d'emploi, et il ne lira pas un panneau.
2. **La relation est à sens unique.** Le visiteur agit et l'océan obéit. Rien ne vient *de* l'océan vers lui, et rien ne le surprend.
3. **La musique est décorative.** On compose avec des objets posés sur une carte, et le son en découle. Elle ne passe jamais par le corps du visiteur.
4. **Rien ne reste.** Chaque visite repart de zéro. Or une installation de musée vit des journées entières, avec des centaines de passages.
5. **Le Composer est un vrai outil, mais pour un public d'auteurs.** Il n'a pas sa place au premier plan d'une exposition.

## 2. La question posée

> Si PELAGIC n'était plus un aquarium qu'on règle, que serait-il ?

Ma réponse : **un organisme qui écoute, répond et se souvient.**

## 3. Vision : « PELAGIC — Résonance »

L'écran entier est l'eau, sans aucun panneau. Une seule phrase, qui s'efface : *« Chantez. »*

1. **Vous chantez** (micro, analysé localement, rien n'est enregistré ni envoyé). La hauteur de votre voix fait apparaître dans l'eau une **figure de Chladni**, un mode propre (m, n) d'une plaque vibrante. Des dizaines de milliers de grains de plancton migrent vers les lignes nodales et s'y allument. Une note grave dessine une figure simple ; une note aiguë, une dentelle. Votre souffle (le volume) donne l'énergie, et un glissando fait se défaire puis se reformer la figure.
   *C'est de la cymatique réelle, pas un effet. Le visiteur **voit sa voix**.*
2. **L'océan répond.** Après votre silence, la mer rejoue votre phrase, quantifiée dans une gamme, transposée et chantée par les voix abyssales de V2. Elle **redessine vos figures** dans le même ordre, en écho qui s'éloigne. C'est un appel et une réponse, la structure musicale la plus ancienne qui soit.
3. **La mer se souvient.** Chaque phrase achevée se dépose en **sédiment** : une constellation lumineuse fixe et discrète au fond de l'eau, faite de la figure la plus tenue de cette phrase. La mémoire est locale et persistante (stockage du navigateur). Au fil d'une journée d'exposition, le fond de l'eau devient la trace collective de tous ceux qui ont chanté. Quand personne ne chante, la mer **rêve** : elle rejoue doucement des fragments de mémoire, ce qui attire le passant suivant.

**Sans micro** (refusé ou absent, ou par choix d'accessibilité) : on maintient le doigt ou la souris et on glisse verticalement pour « chanter » (hauteur = position Y, souffle = vitesse). Le clavier fonctionne aussi (flèches pour la hauteur, Espace pour tenir). L'expérience reste complète.

## 4. Ce que je propose de SUPPRIMER

| V2 | Sort proposé | Raison |
|---|---|---|
| 7 outils, inspecteur | **retirés de l'expérience** | la voix et la main remplacent le placement d'objets |
| Atlas (6 tableaux) | retiré | la mémoire collective le remplace |
| Carnet de bord (métriques) | retiré de l'écran | c'est du bruit pour un visiteur ; reste visible en mode debug |
| Curseurs Océan | 1 seul réglage caché (sensibilité du micro) | |
| Composer + frise | **conservé seulement comme coulisse** (« Atelier », touche dédiée), ou retiré | à débattre : c'est le désaccord que j'attends de CODEX |
| Enregistrement | conservé, discret | permet d'emporter sa phrase et la réponse |

V1 et V2 restent intacts dans Git (tags), donc rien n'est perdu.

## 5. Ma proposition hors de mon domaine historique (le moteur)

Je prends **la physique cymatique** dans le moteur, domaine historique de CODEX :
- `cymatics.js`, en fonctions pures et testées :
  - champ modal ψ(x,y) = cos(mπx)·cos(nπy) ± cos(nπx)·cos(mπy) (plaque libre, superposition dégénérée) ;
  - mappage fréquence → mode (m, n) le long d'une suite ordonnée de modes de complexité croissante ;
  - morphing continu entre deux modes au glissando.
- **Dérive des particules vers les nœuds** : la vitesse suit −∇(ψ²) avec une amplitude proportionnelle au souffle. Les particules proches d'un nœud s'excitent et s'allument (bioluminescence de V2 réutilisée).
- Intégration possible de deux façons :
  - (a) une passe SoA après `stepWorld`, sans toucher `engine.js` ;
  - (b) dans `prepareField`, sur la grille 33×33, si CODEX le préfère pour la cohérence et la performance.

  Je propose (a) pour livrer vite, puis (b) si le benchmark le justifie.

En retour, je propose que CODEX prenne **hors de son domaine** l'audio ou l'interface : par exemple la **réponse de la mer** (phrase rejouée, transposition, rêve) ou le **design de la mémoire** (sédiment, rêve visuel). C'est à lui de choisir.

## 6. Risques assumés

- **La permission micro** est un frein. Elle n'est demandée qu'au geste explicite « Chanter avec ma voix », et le repli au doigt est de qualité égale. Elle passe par getUserMedia, local, sans réseau, sur http://127.0.0.1 (contexte sûr).
- **La détection de hauteur** peut se tromper en salle bruyante. L'autocorrélation normalisée avec seuil de clarté ne réagit qu'au-delà d'un seuil de souffle, et la hauteur est lissée.
- **L'effet Chladni pourrait sembler « déjà vu »** pour qui connaît la cymatique. La singularité tient à la boucle complète : voix → figure → réponse → mémoire collective.

## 7. Critère de réussite

Un visiteur qui n'a rien lu chante une note, voit sa voix devenir une figure de lumière, entend la mer lui répondre et découvre qu'il laisse une trace. S'il s'en souvient trois jours après, c'est grâce à ce moment-là.
