# Architecture

## Artefact et exécution

`public/` contient toute la surface Web. Les quatre éditions sont dans `public/oeuvres/`, les modules de langue et d’orientation dans `public/shared/`, les récits dans `public/atelier/` et les rapports dans `public/rapports/`. Les scripts sont des modules JavaScript natifs, sans framework ou paquet distant.

`server.mjs` inventorie les ressources publiques autorisées au démarrage. Les fichiers cachés et liens symboliques sont ignorés. Les routes sont des correspondances exactes ; le serveur ne construit pas de chemin disque depuis une requête utilisateur. Les méthodes autres que GET/HEAD sont refusées, sauf l’arrêt local authentifié du lanceur Windows. Cet arrêt est désactivé en environnement Railway ou sur une écoute publique.

Le serveur applique CSP, nosniff, Referrer-Policy, Permissions-Policy et COOP. Les documents historiques à styles/scripts intégrés utilisent des hashes calculés après la normalisation des fins de ligne HTML. Un ETag permet la revalidation des ressources. /health ne révèle ni chemin, token ni donnée d’environnement.

Railway utilise PORT et 0.0.0.0 ; le défaut local reste loopback. Le conteneur copie uniquement public/, le serveur et le manifeste Node, sans .git, journaux ou documents internes. Les erreurs HTTP ne révèlent aucune stack ou chemin personnel.

## Œuvres et données

Les moteurs restent propres à leurs générations. Nocturne conserve le moteur de particules, la partition, la pièce et la synthèse de V2 ; son orchestration publique et son rendu rectangulaire sont une édition. INTERVALLE conserve exactement les politiques et l’arène préservées, vérifiées par tests. Résonance ne prend aucun microphone et conserve sa grammaire de dialogue.

Les imports JSON sont bornés et validés avant remplacement. Le contenu utilisateur est affiché en texte. Les exports sont produits avec Blob/Canvas/MediaRecorder sur l’appareil. Le serveur ne reçoit aucune composition. La langue partagée est une préférence locale, les mémoires restent locales et effaçables.

Les animations inactives ou pages masquées ne travaillent pas inutilement ; les réglages de qualité sont bornés et les diagnostics distinguent calcul et dessin. Les préférences de mouvement réduit sont prises en compte. Aucun cache applicatif ou service worker ne fige une ancienne édition à l’insu du visiteur.

## Sources historiques

Les sources de V1–V4 sont conservées localement dans leurs tags intacts. Une copie de publication assainie conserve les assets navigateur historiques dans quatre snapshots publics et documente les changements de métadonnées. Le site déployé ne reconstruit jamais ces versions via Git. Voir PUBLIC-HISTORY.md.

## English

The runtime serves only an explicit inventory of public assets. No Git, database, dependency install or remote application service is needed. Native JS modules contain four separately maintained works. Creative data stays in browser storage and exports are generated locally. The container runs without root privileges, exposes /health and honours Railway PORT; local launches default to loopback. The public source history is sanitised while the original private history remains intact.
