# Public history / Histoire publique

L’historique original reste intégralement préservé sur le poste de création, avec les tags pelagic-v1/v1.0.0, pelagic-v2/v2.0.0, pelagic-v3/v3.0.0 et intervalle-v1/v4.0.0. Il contient des journaux privés et des métadonnées personnelles ; il n’est pas poussé sur Internet.

Le dépôt public est un historique distinct : quatre commits de conservation des sources navigateur, puis l’édition publique V. Les tags v1.0.0 à v4.0.0 du dépôt public désignent ces snapshots assainis. Leurs hashes ne sont pas ceux des tags privés. Les sources HTML/CSS/JS des œuvres sont identiques aux fichiers historiques sélectionnés, avec un petit lanceur Node ajouté pour les ouvrir sans Git. Les journaux, fichiers de coordination privés, identités d’auteur personnelles et configurations d’agents sont exclus.

| Génération | Source originale locale | Snapshot public |
|---|---|---|
| I — Jardin | 1e66482 | v1.0.0 / pelagic-v1 |
| II — Nocturne | 4eb10f3 | v2.0.0 / pelagic-v2 |
| III — Résonance | b566fb3 | v3.0.0 / pelagic-v3 |
| IV — Intervalle | 91b8d43 | v4.0.0 / intervalle-v1 |

L’édition V est un travail sur des copies publiques, pas un remplacement des originaux. Sa production embarque public/ et n’a pas besoin des snapshots ni de .git. Les documents historiques retenus dans docs/ sont des copies publiques ; les chemins personnels sont remplacés par [local workspace] et les emails personnels par [private email] lorsqu’ils existent. Les originaux locaux ne sont jamais expurgés.

Les identifiants de commits privés cités dans les récits permettent d’identifier les sources internes. Ils ne sont pas des liens GitHub vers des commits publics. Les journaux individuels sont des sources de l’édition ; ils ne sont pas intégralement redistribués. Aucune discussion manquante n’a été reconstituée.

English: The public repository has a separate, sanitised history. Four source snapshots precede the public edition. Public v1–v4 tags point to these snapshots, not to the private commits. Original local history and tags remain intact. Browser assets are preserved, a small local preview server is added, and private journals, identities and machine configuration are excluded. Selected documentation is published with personal paths/emails redacted; originals stay unchanged locally. Production needs only server.mjs, package.json and public/.
