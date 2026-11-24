# Verifications de conservation V2

24 novembre 2026 — CODEX. Snapshot conserve avant evolution V3 demandee par utilisateur.

```text

> pelagic@2.0.0 test
> node --test --test-timeout=10000

✔ chaque composition de l’Atlas est acceptée par le moteur (436.9917ms)
✔ chaque composition musicale fait chanter chacune de ses balises (3544.0999ms)
✔ les balises hautes sonnent plus aigu que les profondes, dans chaque gamme (4.8977ms)
✔ les gammes restent dans leurs degrés et une gamme inconnue retombe sur la pentatonic (3.2256ms)
✔ pitchForDepth tolère les valeurs hors bornes (0.5262ms)
✔ noteName nomme la base et l’octave (1.0148ms)
✔ pickRecordingType choisit le premier format pris en charge (0.773ms)
✔ sans Web Audio, le moteur sonore se dégrade sans erreur (5.4839ms)
✔ les alias français sont acceptés comme le moteur (0.5654ms)
✔ les clés héritées d’Object ne passent pas pour des gammes ou des voix (audit CODEX) (0.3309ms)
✔ same seed gives identical trajectories (792.8388ms)
✔ long simulation stays bounded and finite (1458.7842ms)
✔ pause delta does not move particles (110.5501ms)
✔ nodes change the flow and remain finite at their center (3.0804ms)
✔ export/import preserves composition and settings (11.2335ms)
✔ hostile and malformed imports are rejected (8.6563ms)
✔ population and node limits are enforced (3.4973ms)
✔ beacons leave velocity unchanged and survive export (9.6295ms)
✔ move and remove validate identity and coordinates (4.5307ms)
✔ reef size changes the physical deflection and zero strength has no force (1.1196ms)
✔ packed particle buffers persist across steps and support 20000 particles (13.5843ms)
✔ a hand wake excites light, then refractory time prevents constant flashing (74.4946ms)
✔ wake validation and capacity keep transient input bounded (3.0337ms)
✔ V1 composition migration supplies musical and glow defaults (2.4048ms)
✔ the authored nocturne has four distinct editable movements and four musical voices (23.5902ms)
✔ the evolving nocturne produces crossings for all four voices during a complete loop (1864.3675ms)
✔ 20000 particle simulation keeps bounded typed buffers and reports measured step budget (267.6967ms)
ℹ 20000 particles / 3 nodes: 2.60 ms per step; 4 ms is a measured target, not a hardware-independent assertion.
✔ interpolated field stays close to the reference field for a default composition (12.903ms)
✔ speedToT est monotone, borné et robuste (9.8739ms)
✔ fillSegments écrit deux sommets par particule, en pixels, et masque les réapparitions (2.5517ms)
✔ fillSegments ne dépasse jamais la capacité du tampon (8.4055ms)
✔ l’adaptateur V1 convertit des objets et réutilise ses tableaux (0.8877ms)
✔ sans WebGL2, createRenderer se replie sur Canvas 2D (1.2ms)
✔ score captures are isolated and interpolate positions and force (25.6843ms)
✔ appearance and disappearance fade and identities survive sampling (8.3101ms)
✔ applying a score preserves particle buffers, time and existing node objects (6.8115ms)
✔ score roundtrip and V1 migration preserve editable compositions (17.1327ms)
✔ invalid score files cannot replace a composition (7.2269ms)
✔ transport handles pause, tempo, loop, end and large deltas (0.8671ms)
✔ loopback server serves modules and blocks private paths and mutations (3768.4385ms)
✔ beatSeconds borne le tempo (2.8371ms)
✔ nextSlot vise la prochaine croche, ou la case courante si on est dessus (2.5034ms)
✔ quantizeDelay convertit en secondes et respecte la désactivation (2.6056ms)
✔ accentOf : temps fort > temps > contretemps (0.5323ms)
✔ crossingsSoA compte seulement les entrées (0.824ms)
✔ le chef quantifié joue une note par case et par balise, avec voix et délai (1.2049ms)
✔ le chef ignore les balises en fondu et les autres éléments (2.064ms)
✔ playheadInfo découpe la boucle en quatre mouvements (4.9163ms)
✔ barBeat donne mesure et temps 1-indexés, en boucle (0.5468ms)
✔ fitSquare centre un carré dans un canevas large (4.2089ms)
✔ screenToWorld convertit et rejette hors du carré (0.8686ms)
✔ nodeAt retourne le plus proche dans le rayon (3.8423ms)
✔ nudgeStrength respecte les bornes du moteur et évite zéro (1.6199ms)
✔ speedBucket est monotone et borné (1.5996ms)
✔ crossings ne compte que les entrées dans la zone (0.5847ms)
✔ base64url fait un aller-retour UTF-8 et refuse les caractères invalides (3.0446ms)
✔ formatTime et describeNode produisent un texte lisible (1.4193ms)
ℹ tests 57
ℹ suites 0
ℹ pass 57
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 4923.9231
```

Controles navigateur CODEX avant interruption : Main lumineux ; import V1 et partition V2 ; export JSON reellement telecharge et reparse ; refus de fichier invalide ; WebM telecharge (204383 octets, en-tete EBML) ; Nocturne a10000 puis20000particules ; renommage par dialogueHTML ; mobile375 sans debordement de page. Qualite auditive et lecteur ecran complet non certifies. Voir .agents/CODEX.md et V2-REVIEW.md.
