# Contrat V2 — CODEX / CLAUDE

Synthèse après confrontation indépendante du 24 novembre 2026. Pas d'Expéditions : deux modes Explorer et Composer, une partition de quatre mouvements, lumière vivante, geste Main et musique quantifiée.

## engine.js

API V1 conservée. `world.p = {n,cap,x,y,px,py,age,speed,light,refract}` : tableaux Float32Array. `world.particles` est une vue de compatibilité paresseuse pour les anciens tests/outils ; ne pas l'utiliser pour le rendu ni les traversées V2.

Réglages `{speed,turbulence,count,glow}` ; count 100–20000, glow 0–1 (défaut .55). `createWorld(seed)` fournit aussi `wakes:[]`. `addWake(world,x,y,vx,vy,radius=.08)` crée un sillage transitoire ; entrée bornée, rayon .02–.2, maximum 48 sillages. `stepWorld` consomme le champ et les sillages, excite/décroît light et refract. `getMetrics` ajoute `lit` (fraction light>.5), `brightness` (luminance moyenne), `flashes` (nombre de déclenchements du dernier pas). `sampleLight(world,x,y,r)` retourne la moyenne dans un disque.

Nœuds `{id,key,type,x,y,strength,voice,opacity}`. Types V1 ; voice glass/bell/pluck/breath ; opacity utilisée par interpolation/rendu. `addNode` renvoie ce nœud. Le renderer respecte opacity, le son ignore les balises très transparentes.

`serializeWorld` écrit une composition version2 ; `deserializeWorld` accepte compositions V1/V2. L'export de pièce complet se fait par score.js.

## score.js

- `createScore({world,settings,bars=16,tempo=84,scale='pentatonic',title='Mon Nocturne',movements}={})` retourne un objet score mutable validé.
- `score={version:2,kind:'score',title,bars,tempo,scale,movements:[{name,seed,nodes,settings}×4]}`. Bars 4–64, tempo 50–140, scale pentatonic/dorian/insen/lydian. Quatre mouvements, de même durée en mesures, boucle.
- `captureMovement(score,index,world,settings)` remplace les nodes/settings/seed du mouvement, conserve son nom. Mutation explicite, retourne score.
- `sampleScore(score,beat)` → `{nodes,settings,seed,movement,nextMovement,blend,phase,beat}`. Le beat est en noires, période `bars*4`. Positions/forces interpolées (cosinus), élément absent fondu vers force0/opacity0. Les éléments gardent key/id entre captures. Count est celui du mouvement de départ, ne pas régénérer les particules à chaque frame.
- `applySample(world,sample)` réutilise les identités et met à jour world.nodes ; ne réinitialise ni particules ni temps. Retourne world.
- `serializeScore(score)` → JSON ; `deserializeScore(json)` → score. Ce dernier accepte aussi les compositions V1/V2 et les déplie sur quatre mouvements identiques. Limite entrée128Ko, 24pistes distinctes dans toute la partition pour garantir24éléments maximum même pendant les fondus. Validation stricte et erreur française.
- `advanceTransport(transport,dt,score)` → nouvel état `{beat,playing,loop,ended}` ; pas de mutation. Bornage dt<=.25 s, tempo en noires/minute. Lecture sans boucle s'arrête à la fin.

Les interpolations décrivent une partition, pas un enregistrement exact du plancton. La boucle UI utilise un accumulateur à pas fixe1/60 s ; la même graine et les mêmes gestes aux mêmes pas permettent la reproductibilité.

## Répartition

CODEX : engine.js, score.js, tests correspondants/performance, serveur, documents communs. CLAUDE : rendu, audio, interaction, frise et refonte UI. Nouveaux modules servis uniquement après ajout explicite à la liste blanche.
