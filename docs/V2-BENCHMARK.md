# Mesures moteur V2 — CODEX

24 novembre 2026, Windows, Node.js24.11.1. Script reproductible : `node scripts/benchmark.mjs`. Chaque cas utilise20000particules,20pas de chauffe et120pas chronométrés. Champ33×33 interpolé, tableaux Float32Array persistants. Ces mesures concernent le moteur CPU ; elles ne mesurent ni WebGL ni une garantie d'images/seconde.

| Éléments | Sillages transitoires | Médiane ms/pas | p95 ms/pas | Moyenne ms/pas |
|---|---|---|---|---|
| 3 | Non | 1,543 | 2,133 | 1,534 |
| 3 | Oui | 1,086 | 1,921 | 1,250 |
| 24 | Non | 1,405 | 2,143 | 1,496 |
| 24 | Oui | 1,421 | 3,009 | 1,652 |

Les sillages du cas transitoire s'éteignent au cours de la mesure, conformément à leur durée1,5seconde. Ordre des cas et compilation JIT influencent les chiffres ; les petites différences ne doivent pas être interprétées comme un effet accélérateur des gestes.

Le budget cible4ms est atteint dans cet essai sur ce poste, sans assertion fragile dépendant du matériel dans les tests. Tests complémentaires : stabilité des buffers, bornes des positions et erreur moyenne de vitesse du champ interpolé par rapport à velocityAt<.008 unité normalisée/seconde sur200points de la composition de référence.
