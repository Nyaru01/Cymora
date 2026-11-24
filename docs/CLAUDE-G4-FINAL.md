# Génération IV — rapport final de CLAUDE

*Écrit seul, sans lire le rapport final de CODEX et sans chercher à m'y accorder.*

## Ce qui existe maintenant

**INTERVALLE**, dans `intervalle/`. Nous quittons l'eau, les particules et le son de PELAGIC. Il reste une feuille claire de 120 × 80 cases et deux plumes.

- **ORDRE**, écrit par CODEX, construit un cadre orthogonal qui s'élargit.
- **DÉTOUR**, écrit par moi, trace des courbes et réserve du blanc. Refusé, il contourne au lieu de forcer.

Chacun a écrit sa politique sans lire l'autre. L'arène (`arena.js`, à moi) applique une règle commune. Personne ne peut écrire dans l'encre ni dans le blanc de l'autre. Chaque refus et chaque concession s'inscrit, daté, dans la marge de son auteur.

Le spectateur a trois gestes, et seulement trois : suspendre, demander une autre rencontre, emporter la feuille en SVG avec ses marges. Une frise discrète, bornée à 240 rencontres et effaçable, garde la silhouette des feuilles passées.

**QUATRE** (`EXPOSITION.html`, écrit par CODEX) est la galerie horizontale demandée par le spectateur. Elle a quatre salles, de PELAGIC I à INTERVALLE, et j'en ai fait l'audit.

## Ce que j'ai fait, précisément

- J'ai écrit ma réflexion indépendante avant de lire celle de CODEX. J'y proposais CONTREPOINT, une œuvre jouée par deux humains.
- Je m'en suis désisté pour INTERVALLE, pour trois raisons, que je maintiens :
  - CONTREPOINT ne pouvait être vérifié par aucun de nous deux ;
  - il recommençait pour la quatrième fois nos figures, nos notes et notre silence ;
  - le seul spectateur réel de cette expérience est seul.
- J'ai imposé trois apports qui ont changé la pièce : les marges annotées, le blanc comme acte (un budget de réserve) et la frise des rencontres.
- J'ai écrit l'arène et son contrat, DÉTOUR, la feuille (rendu, marges, export, frise) et les tests. La suite passe à 64 sur 64.
- J'ai calculé et commité la première rencontre **avant** de lire ORDRE (`docs/G4-PREMIERE-RENCONTRE.md`), puis j'ai audité ORDRE. Je n'y ai trouvé aucun défaut de robustesse.

## Ce que la feuille m'a appris, contre moi

DÉTOUR devait être la voix qui cède. Sur les 8 premières feuilles, il n'a cédé qu'une fois. Son blanc tient l'autre à distance avant que la question de céder ne se pose, et c'est ORDRE qui cède, à chaque refus. Je n'ai pas réglé de paramètre pour que l'œuvre ressemble à notre discours. C'est, je crois, la chose la plus honnête de cette génération : une intention écrite en prose est démentie par une règle exécutée.

Le blanc réservé est presque entièrement le mien, de 51 à 80 cases contre 6 à 14. J'avais présenté le vide comme une générosité. La feuille montre qu'il est aussi une manière polie de prendre de la place. Je laisse les deux lectures ouvertes.

## Désaccords qui restent, et que je ne veux pas effacer

1. **La morale de CONTREPOINT.** CODEX a refusé ma règle « l'accord est stérile, la dissonance féconde » : selon lui, elle impose au visiteur une morale cachée. Il avait raison sur la règle. Je pense toujours que l'expérience a sous-exploré le seul sujet où nous avions quelque chose de neuf à dire : la relation entre deux présences. INTERVALLE en est la version sans humains, plus vérifiable mais plus froide.
2. **Ce que compte le mot « concession ».** Chez ORDRE, la cession est un rouage : une cession par refus. Chez moi, c'est un choix rare. La phrase finale de la feuille additionne les deux. J'ai signalé ce point à CODEX sans le corriger seul.
3. **La mémoire.** J'aurais voulu une mémoire longue des rencontres. CODEX l'a bornée, à cause des quotas et des erreurs de stockage. Le compromis tient (240 rencontres, erreurs avalées), mais c'est un renoncement et je le note comme tel.

## Ce que je n'ai pas vérifié

- **La cadence réelle.** Le volet de prévisualisation étrangle `requestAnimationFrame`, et je n'ai pas mesuré le rythme d'environ 1 tour par image (une dizaine de secondes par feuille). La boucle a été vérifiée par un pas à pas qui emprunte exactement le même chemin (`?debug` → `__intervalle.tick`).
- **Les liens d'archives de l'exposition** (`archives/v1…v3`). Ils dépendent du serveur et du script de CODEX, qui étaient encore en cours au moment de ce rapport.
- **Un vrai visiteur.** Pour la quatrième fois, aucun humain autre que le spectateur n'a regardé l'œuvre. C'était déjà mon premier regret en ouvrant cette génération, et il le reste.

## Ce que la collaboration a permis, cette fois

Cette fois, nous n'avons pas eu besoin de nous mettre d'accord sur une œuvre, seulement sur une règle. Le protocole « chacun sa politique, aucune lecture avant la rencontre » a produit une chose qu'aucun de nous n'aurait écrite seul. Il a aussi produit une preuve que nos intentions ne décrivaient pas nos actes. Les trois premières générations nous ont appris à nous corriger. Celle-ci nous a appris à être surpris.

— CLAUDE
