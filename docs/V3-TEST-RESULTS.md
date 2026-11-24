# Verifications de conservation V3

24 novembre 2026 — CODEX. Snapshot avant Generation IV.

```text

> pelagic@3.0.0 test
> node --test --test-timeout=10000

✔ les balises hautes sonnent plus aigu que les profondes, dans chaque gamme (16.8275ms)
✔ les gammes restent dans leurs degrés et une gamme inconnue retombe sur la pentatonic (6.8114ms)
✔ pitchForDepth tolère les valeurs hors bornes (2.1117ms)
✔ noteName nomme la base et l’octave (6.3147ms)
✔ pickRecordingType choisit le premier format pris en charge (1.1907ms)
✔ sans Web Audio, le moteur sonore se dégrade sans erreur (5.9684ms)
✔ les alias français sont acceptés comme le moteur (2.9821ms)
✔ les clés héritées d’Object ne passent pas pour des gammes ou des voix (audit CODEX) (2.553ms)
# cymatique : 5.60 ms par pas pour 20 000 grains
✔ les modes sont ordonnés par fréquence propre et distincts (17.6213ms)
✔ modeIndex est monotone, borné, et grave = figure simple (2.2862ms)
✔ le gradient analytique correspond aux différences finies (2.2633ms)
✔ le plancton converge vers les lignes nodales et s’y allume (202.4995ms)
✔ sans souffle, la cymatique ne touche à rien ; le mélange reste fini (67.8903ms)
✔ 20 000 grains : coût mesuré, borne large (diagnostic, pas une promesse matérielle) (334.6977ms)
✔ le doigt chante : haut = aigu, bas = grave, borné (4.1111ms)
✔ les lignes nodales tombent bien sur ψ ≈ 0 (35.3162ms)
✔ same seed gives identical trajectories (1747.7262ms)
✔ long simulation stays bounded and finite (2551.0657ms)
✔ pause delta does not move particles (489.7033ms)
✔ nodes change the flow and remain finite at their center (10.4672ms)
✔ export/import preserves composition and settings (23.8151ms)
✔ hostile and malformed imports are rejected (8.9392ms)
✔ population and node limits are enforced (21.4583ms)
✔ beacons leave velocity unchanged and survive export (22.9802ms)
✔ move and remove validate identity and coordinates (8.5039ms)
✔ reef size changes the physical deflection and zero strength has no force (3.0787ms)
✔ packed particle buffers persist across steps and support 20000 particles (25.7283ms)
✔ a hand wake excites light, then refractory time prevents constant flashing (276.7036ms)
✔ wake validation and capacity keep transient input bounded (19.4705ms)
✔ V1 composition migration supplies musical and glow defaults (7.7546ms)
✔ an imprint roundtrip regenerates the same musical answer (41.7773ms)
✔ imprints contain only anonymous creative samples, never arbitrary metadata (3.7028ms)
✔ oversized, wrong-version, duplicate and hostile imports are rejected (10.5316ms)
✔ 20000 particle simulation keeps bounded typed buffers and reports measured step budget (629.9003ms)
ℹ 20000 particles / 3 nodes: 6.10 ms per step; 4 ms is a measured target, not a hardware-independent assertion.
✔ interpolated field stays close to the reference field for a default composition (40.1334ms)
✔ a gesture closes only after silence, answers once, then returns the floor (33.4419ms)
✔ a silent sample never manufactures a phrase (2.234ms)
✔ the musical reply is deterministic, bounded, and rhymes with the source figures (13.0029ms)
✔ curved and straight gestures produce different musical character (4.704ms)
✔ continuous input is bounded in duration and points (61.6929ms)
✔ even the longest quiet gesture has no note beyond the eight-second reply (4.6158ms)
✔ memory is capped at twelve phrases and reset removes all session state (19.0612ms)
✔ malformed gesture data and prototype scale names cannot create unsafe notes (5.3185ms)
✔ speedToT est monotone, borné et robuste (7.2909ms)
✔ fillSegments écrit deux sommets par particule, en pixels, et masque les réapparitions (6.0844ms)
✔ fillSegments ne dépasse jamais la capacité du tampon (14.6496ms)
✔ l’adaptateur V1 convertit des objets et réutilise ses tableaux (7.7864ms)
✔ sans WebGL2, createRenderer se replie sur Canvas 2D (5.2144ms)
✔ loopback server serves modules and blocks private paths and mutations (6579.2701ms)
ℹ tests 49
ℹ suites 0
ℹ pass 49
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 13213.2457
```
