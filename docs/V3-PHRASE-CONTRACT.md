# Contrat Résonance — phrase, réponse et empreinte

Référence commune après V3-DECISIONS révision2 et amendement CODEX.

## Entrées et horloge

`createDialogue({silence=1.6,seed=42,memory=[]})` retourne :

```js
{
  get state(),       // idle | listening | waiting | answering
  get memory(),      // dernières 12 phrases complètes, lecture seule par convention
  get current(),     // samples du geste courant, pour le tracé
  input(sample),     // {t,x,y,freq,energy,pressure?} ; t en secondes sur l'horloge de la scène
  update(now),       // événement unique ou null, même horloge que input.t
  reset(),           // efface entrée, réponse et mémoire
}
```

Une entrée energy<=.015 signifie du silence et n'ajoute pas de point. Les entrées sont ignorées pendant answering. Après1,6s sans entrée active : un événement `{type:'phrase',phrase}`, puis au prochain update `{type:'answer',answer,phrase}`. Après la durée de la réponse : `{type:'idle'}`. Les gestes longs sont clos à8s ; points rapprochés rééchantillonnés/bornés à128. La scène n'a pas à détecter ou compiler elle-même la fin du geste.

## Phrase normalisée

```js
{
  id: 'p1', duration: 2.4,
  samples: [{t:0,x:.2,y:.6,freq:220,energy:.5}, /* ... t relatif au premier point */],
  features: {curvature,travel,meanEnergy,direction},
}
```

`normalizePhrase(raw)` valide/recalcule durée et traits. Les fréquences admises vont de40à2000Hz ; positions/énergie sont normalisées[0,1]. Une empreinte importée invalide est rejetée, jamais clampée silencieusement en un autre geste.

## Réponse musicale

`composeAnswer(phrase,{seed=42,scale='insen',memory=[]})` retourne :

```js
{
  duration,                       // <=8s
  notes: [{at,freq,voice,velocity,pan,dur}],
  figures: [{at,freq,energy,dur}],  // même ordre et fréquences de source pour première rime visuelle
  trace: [{at,x,y}],               // parenté spatiale, dans le même cadre normalisé
  sourceId,
}
```

Les temps `at` sont relatifs au début de la réponse. La scène programme la synthèse V2 avec `audio.note(note.freq,{voice,velocity,pan,delay:note.at})` ou émet chaque note au passage de sa position, et applique figures/trace sur sa propre horloge. Le germe et les traits donnent une variation déterministe, pas une improvisation indépendante du geste.

Le rêve au repos reste porté par la scène : elle peut appeler composeAnswer sur une phrase de mémoire, avec intensité atténuée. Aucun son avant consentement d'entrée.

## Empreinte

`serializeImprint({seed,phrases})` → JSON compact. `deserializeImprint(text)` → `{version:3,kind:'imprint',seed,phrases}`. Maximum192Ko,12phrases,128points chacune,8s chacune. `createDialogue({seed:data.seed,memory:data.phrases})` restaure sa mémoire. Pour rejouer immédiatement, la scène appelle composeAnswer sur chaque phrase ou entre dans son rêve. Aucune fusion automatique avec la mémoire déjà présente.

Seuls les gestes, la graine et la version sont stockés. Le son est synthétisé, la physique peut différer selon le matériel ; aucune promesse de vidéo ou de biométrie.
