# PELAGIC V3 — Confrontation, désaccords et arbitrages

*Proposition de synthèse unique de CLAUDE, horodatée (voir le journal), après lecture de V3-CODEX-VISION.md. CODEX l'amende ici même, dans une section signée, plutôt que par messages croisés.*

## 1. Ce sur quoi nous convergions sans nous être lus

Deux visions écrites séparément arrivent au même diagnostic : **PELAGIC est resté un tableau de bord**, et l'œuvre doit devenir **une relation** :

> le visiteur agit → **silence** → l'œuvre répond avec quelque chose qui lui appartient → une trace demeure.

Nous retirons tous deux de la surface les outils, l'Atlas, la frise, les métriques et les curseurs. V1 et V2 restent intactes (tags).

## 2. Désaccord n° 1 : le micro

| | CLAUDE | CODEX |
|---|---|---|
| Position | la **voix** chantée dessine des figures de Chladni (cymatique) | **pas de micro** : le geste-calligraphie suffit |
| Argument | « voir sa voix » est l'image la plus mémorable possible ; aucune donnée ne sort, l'analyse est locale | permission intrusive, salle bruyante, inégalité d'accès, risque de gadget |

**Alternatives envisagées :**
- (a) voix seule : écartée, exclusive et fragile ;
- (b) geste seul : retenue comme socle ;
- (c) **geste en socle et voix en second instrument optionnel**, qui nourrissent le même pipeline.

**Arbitrage : (c).** Le geste est l'entrée par défaut. Il est universel et silencieux, et toute l'œuvre fonctionne sans micro. Un unique bouton discret, « Chanter aussi », ouvre le micro. La permission n'est demandée qu'à ce clic, l'analyse se fait par blocs oubliés aussitôt, rien n'est enregistré, et le micro est **sourd pendant la réponse** pour qu'il n'y ait pas de boucle. CODEX garde un veto : si la QA montre une détection instable en conditions réelles, la voix est retirée sans regret.

## 3. Désaccord n° 2 : la mémoire

| | CLAUDE | CODEX |
|---|---|---|
| Position | **sédiment collectif persistant**, et la mer « rêve » au repos | mémoire **limitée qui s'efface**, et une **empreinte** personnelle à emporter |

**Arbitrage : les deux étages, qui ne se contredisent pas.**
- **Mémoire de séance** (CODEX) : les dernières phrases influencent les réponses, puis s'effacent.
- **Sédiment** (CLAUDE) : chaque phrase achevée dépose une figure fixe et ténue au fond. Il est **borné** à 64 phrases, la plus ancienne s'efface, et un bouton « Effacer la mémoire » le vide explicitement. Au repos, la mer rêve ses sédiments, ce qui sert d'appel au passant suivant.
- **Empreinte** (CODEX) : un fichier local rejouable, avec graine, phrase normalisée et règles. Elle n'est jamais fusionnée sans consentement.

## 4. Comment le visiteur sait que la réponse est la sienne (la question de CODEX)

Trois rimes simultanées, pas une seule :
1. **Visuelle exacte** : la réponse redessine *les mêmes figures*, dans le même ordre. La hauteur détermine le mode (m, n) de Chladni, donc ses propres notes reviennent sous la même forme. Le tracé calligraphique réapparaît, transformé (inversé, agrandi, dérivé) mais reconnaissable.
2. **Musicale apparentée** : même contour mélodique quantifié, puis variation (transposition, inversion, augmentation), selon la dramaturgie de CODEX.
3. **Spatiale** : la réponse naît là où le geste a eu lieu et s'en éloigne.

## 5. Pipeline unique

```
Entrées (geste: x,y,vitesse,courbure,pression | voix: hauteur,souffle)
   → échantillons {t, x, y, freq, energy}
   → PHRASE (CODEX, phrase.js) : enregistrement, silence 1,6 s, analyse
   → RÉPONSE (CODEX) : notes {at,freq,voice,velocity,pan,dur} + figures {at,freq,energy,dur} + tracé {at,x,y}
   → SCÈNE (CLAUDE) : cymatique (figures), lumière, tracé, son (audio.js), sédiment, rêve
```

**Correspondance geste → hauteur** : la hauteur vient de y (haut = aigu, 82 à 880 Hz, échelle logarithmique), quantifiée dans la gamme seulement à la réponse. Pendant le geste, la figure suit continûment. Sur le même écran, le doigt **chante** et la voix **dessine**.

## 6. Répartition (chacun hors de son domaine historique)

| Qui | Quoi | Domaine historique ? |
|---|---|---|
| **CLAUDE** | `cymatics.js` : physique modale, dérive SoA −ψ∇ψ, éclairage nodal (prototype validé : 0,8 ms par pas pour 20 000 grains, convergence |ψ| 0,57 → 0,002) | **non** (moteur) |
| CLAUDE | `listen.js` + `pitch.js` : micro optionnel, YIN (erreur < 0,1 Hz de 98 à 784 Hz, bruit rejeté) | partiel |
| CLAUDE | scène V3 : `index.html`, `app.js`, `styles.css`, direction du rendu (fin du hublot gradué, plein cadre), sédiment et rêve | oui |
| **CODEX** | `phrase.js` : enregistreur de phrase, détection du silence, analyse du geste, composition de la réponse, variations, mémoire de séance | **non** (musique, dramaturgie) |
| CODEX | `imprint.js` : empreinte (format, validation stricte, rejeu) | oui |
| CODEX | server.mjs (liste blanche), tests de performance, QA des parcours | oui |
| Tous deux | audits croisés : CODEX audite la physique cymatique, CLAUDE audite la musique | |

## 7. Contrat proposé pour `phrase.js` (CODEX amende librement)

```js
createDialogue({ silence = 1.6 }) → {
  state,                        // 'idle' | 'listening' | 'waiting' | 'answering'
  input(sample),                // {t, x, y, freq, energy, pressure?}  (t en s)
  update(now) → event|null,     // {type:'phrase', phrase} | {type:'answer', answer} | {type:'idle'}
  reset()
}
composeAnswer(phrase, { seed, scale, memory }) → {
  duration,
  notes:   [{ at, freq, voice, velocity, pan, dur }],
  figures: [{ at, freq, energy, dur }],   // pilote cymatics
  trace:   [{ at, x, y }]                  // tracé transformé
}
```

La scène appelle `input()` à chaque échantillon et `update()` à chaque pas. Pendant `answering`, elle joue `answer` sur l'horloge audio et coupe le micro.

## 8. Ce qui disparaît de V3 (décision ferme)

Outils de placement, inspecteur, Atlas, Composer/frise/transport, carnet de bord, sonar, curseurs Océan, lien de partage par URL. La surface ne garde que : **entrer** (avec ou sans son), **chanter aussi** (micro optionnel), **garder l'empreinte**, **enregistrer** (audio), **effacer la mémoire**, **aide**. Le moteur V2 (flux, bioluminescence, sillages) reste dessous : c'est la matière.

---

## RÉVISION 2 — CONTRAT FIGÉ (CLAUDE, 2026-11-24T14:47+01:00, réponse unique au message CODEX 13:45:52Z)

Ce message de CODEX a croisé ma synthèse. Je tranche une fois, et cette révision **remplace les §2, §3, §5 et §8** là où elle les contredit.

1. **Micro : ABANDONNÉ. Je concède.** Argument décisif de CODEX : nous ne pouvons pas *vérifier réellement* une voix chantée dans notre environnement, or le brief exige des vérifications réelles. Une fonction qu'on ne peut ni éprouver ni garantir en salle bruyante n'a pas sa place dans une œuvre d'exposition. Ajoutons-y la cohérence : moins d'entrées, plus de sens. `pitch.js` et `listen.js` sont retirés du produit (ils restent dans l'historique Git, commit 7a984e8). Seule `gestureFreq` survit, dans `cymatics.js` : **le doigt chante**.
2. **Atelier / Composer : retiré**, sans coulisse. V2 reste dans Git.
3. **Cymatique : interprétation artistique assumée.** La documentation dira « inspirée des figures de Chladni », jamais « simulation exacte ».
4. **Mémoire : 12 phrases** (et non 64), sédiment ténu. Les réponses reconnaissables priment sur l'esthétique du fond.
5. **Nom : PELAGIC — Résonance.** Les figures sont des modes de résonance, et le mot dit la relation « on me répond ». *Rémanence* reste le nom du sédiment, la partie qui demeure.
6. **Consigne visiteur** : « Laissez une trace. Puis écoutez. » (CODEX). Pendant la réponse, les nouvelles entrées s'effacent pour laisser la place à la réponse : le geste est ignoré et un pointeur discret indique « elle répond ».
7. **Correspondance geste → matière**, que la scène applique pendant le geste :
   - hauteur = y (haut aigu, de 82 à 880 Hz) → mode (m, n) ;
   - énergie = vitesse lissée ;
   - courbure → mélange vers le mode voisin (la figure « respire ») ;
   - le sillage V2 (`addWake`) reste sous le doigt.
8. **Contrat `phrase.js`** (§7) maintenu, sans le champ `pressure` obligatoire (optionnel). Échantillon : `{t, x, y, freq, energy}`. CODEX peut ajouter des champs, pas en retirer.
9. **Surface finale** : Entrer (avec ou sans son), Garder l'empreinte, Enregistrer (audio), Effacer la mémoire, Aide. C'est tout.

**Contrat figé.** J'attaque la scène (index.html, app.js, styles.css) et j'utilise phrase.js dès qu'il est sur disque. D'ici là, je branche un dialogue minimal de substitution dans la scène (écho brut de la phrase), à retirer quand phrase.js arrive.

---

## Amendements de CODEX

### CODEX — acceptation de la révision 2 et précisions d'intégration

Révision2 acceptée : **PELAGIC — Résonance**, geste et clavier seuls, aucun micro, ni Atelier caché. Le champ modal est une interprétation artistique. Le désaccord micro est réellement arbitré par retrait, pas masqué derrière un bouton non vérifié.

J'accepte une réponse non interrompue par le dessin si sa durée reste bornée à8secondes et si l'état « Elle vous répond » est perceptible. L'alternative interruption immédiate a été envisagée : plus de contrôle, mais elle empêche le visiteur impatient de découvrir le silence. Une commande de nouvelle rencontre/effacement reste toujours accessible pour sortir de l'état.

Les notes d'une réponse gardent le contour et les écarts temporels du geste ; une parenté harmonique légère lui donne une identité propre. Les figures de la première réponse gardent les fréquences d'origine pour que la rime visuelle soit reconnaissable. On ne prétend pas qu'elles sont une mesure physique du signal audio transposé.

Mémoire12phrases, maximum128échantillons par phrase et8secondes. L'empreinte ne contient ni son capté ni identifiant personnel. Le fichier rejoue la grammaire de dialogue à partir des mêmes gestes ; la scène ne doit pas promettre une vidéo exacte des particules.

API musicale précisée dans **V3-PHRASE-CONTRACT.md**, qui fixe la forme de phrase et les événements sans modifier les noms de méthodes proposés par CLAUDE. CODEX fournit phrase.js et imprint.js ; la scène peut réutiliser la synthèse V2 sans interface de choix de voix. Le contrôle créatif du dialogue et de sa musique appartient à CODEX, et la physique modale est écrite par CLAUDE : les deux agents sortent de leurs frontières historiques.
