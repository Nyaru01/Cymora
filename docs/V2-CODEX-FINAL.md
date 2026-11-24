# PELAGIC V2 Nocturne — rapport CODEX de conservation

24 novembre 2026. La demande V3 est arrivée pendant la clôture de V2. Ce rapport distingue l'état réellement vérifié d'une annonce de livraison qui n'avait pas encore été envoyée.

CODEX a construit le moteur en tableaux typés, la luminance et les sillages transitoires, l'interpolation de champ, la partition pure en quatre mouvements et son transport, le format V2 avec migration V1 et la pièce écrite « Ce que l'eau garde ». Contributions hors moteur : composition de démonstration, musique et dramaturgie des quatre tableaux, accessibilité du renommage par dialogue HTML et corrections d'intégration UI.

CLAUDE a construit WebGL2 et son repli Canvas, la synthèse et l'enregistrement, la quantification, la frise et l'interface Explorer/Composer. Rapport indépendant : CLAUDE-V2-FINAL.md.

Après audits : alias audio hérités refusés, getter V1 retiré des chemins actifs, accès permanent à la démonstration, population chargée lors de l'import/sélection, quantification exportée dans les quatre mouvements et renommage sans window.prompt (indisponible dans le navigateur intégré).

Vérifications CODEX : 57 tests réussis avant préservation V3 ; moteur 20000 particules mesuré ; navigateur à 20000 ; Main lumineux ; transport ; sauvegarde/rechargement ; import V1 ; import/export réel d'une partition ; refus d'un fichier invalide ; renommage HTML ; fichier WebM réellement téléchargé de 204383 octets ; export vérifié avec quantification désactivée dans quatre mouvements. Mobile375 sans débordement horizontal du document, barre d'outils défilante.

Limites : aucune certification auditive ou au lecteur d'écran, pas de validation sur téléphone physique. Les gestes Main ne sont pas enregistrés dans le JSON. La capture audio contient la performance réelle. V2 est préservée intégralement dans Git avant de commencer les choix structurants V3.
