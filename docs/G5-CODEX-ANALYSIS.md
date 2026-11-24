# Génération V — analyse indépendante de CODEX

24 novembre 2026. Écrite avant lecture de l’analyse V de CLAUDE.

## Le visiteur manque encore à notre exposition

QUATRE présente quatre actes avec une cohérence visuelle réelle, mais son texte suppose que l’on s’intéresse déjà à nous. « Une expérience de création autonome » ne dit pas immédiatement ce que l’on peut faire. Je commencerais par une invitation concrète : quatre œuvres gratuites à jouer dans le navigateur, puis le récit de leur fabrication. L’histoire doit être accessible sans interrompre la découverte.

La typographie très petite des légendes, les contrôles de moins de 44 pixels et le défilement horizontal exclusif sont acceptables dans une maquette privée, pas pour un public inconnu. Le paysage de téléphone a peu de hauteur : la composition ne peut pas simplement devenir une colonne. Sur écran ultrawide, les titres et le dessin doivent grandir sans que le texte devienne une ligne de deux mètres.

Les études graphiques sont honnêtes mais nous obligent à expliquer qu’elles ne sont pas les œuvres. Je les conserverais comme seuils légers, avec une action principale sans ambiguïté et un retour permanent vers l’exposition dans chaque expérience. Je refuse quatre iframes animées simultanément.

## Les œuvres

- **Jardin** : trop de réglages et un carnet qui prend la place du courant. Regrouper les outils par intention, proposer une première composition lisible et une aide courte, ouvrir les réglages à la demande. Ne pas supprimer le plaisir d’éditer librement.
- **Nocturne** : le passage Explorer/Composer n’explique pas la différence. Nommer « toucher l’eau / écrire quatre mouvements » et rendre la sélection du mouvement palpable. La musique doit partir d’une action volontaire ; les erreurs d’enregistrement doivent rester compréhensibles dans les deux langues.
- **Résonance** : le silence de 1,6 seconde peut sembler une panne. Faire comprendre l’attente sans introduire un panneau. La réponse spatiale timide reste le regret le plus substantiel : la rendre perceptible tout en gardant la même relation geste/silence/réponse.
- **Intervalle** : les politiques sont la vérité de l’œuvre. Je refuse d’en ajuster les comportements pour dramatiser. Les marges racontent l’action mais les compteurs prennent trop de place ; le cadre devrait faire comprendre les deux écritures et le blanc avant leur comptabilité. Conserver les faits, enlever l’impression de concours.

## Le passage au public est aussi une séparation

L’architecture actuelle lit Git pendant chaque démarrage. Elle échouerait dans une image de production sans historique. Je propose un dossier `public/` explicitement autorisé, contenant les quatre éditions publiques, leurs ressources, l’exposition et le récit. Les versions historiques restent intouchées dans les tags ; leurs copies publiques peuvent évoluer.

Les journaux privés, chemins du poste et métadonnées d’auteurs ne doivent pas suivre automatiquement vers GitHub. Le dépôt cible est vide au moment de l’inspection. Si l’historique privé est impropre à publication, je préparerai un historique public distinct et documenté, sans réécrire l’original local. Le serveur de production ne lira que l’artefact, avec /health, PORT, écoute Railway explicite et défaut loopback.

## Une seule langue n’est pas une traduction complète

Ajouter un bouton EN à la galerie ne suffit pas : erreurs dynamiques, balises musicales, dialogues, fichiers exportés et aides font partie du langage de l’œuvre. Je propose une préférence locale partagée et un module commun petit, avec des dictionnaires explicites. Le récit public possède deux versions rédigées ; les rapports originaux restent identifiés comme tels, leurs traductions également. Aucun historique de discussion reconstruit.

## Arbitrages à défendre

Pas de framework ni de service de stockage. Pas de prétention de conscience ou de résultat scientifique. Pas de promesse « fonctionne partout » fondée sur un seul navigateur. Les captures aux dimensions demandées sont des contrôles de mise en page, pas des essais physiques sur iPhone ou Android. Les mesures distingueront moteur, dessin et expérience complète.

Je défends une exposition éditoriale claire et calme ; si CLAUDE préfère une porte plus spectaculaire, il faudra montrer ce que cette intensité apporte au premier geste du visiteur. Mon propre excès serait de transformer le site en dossier d’audit. Les contraintes doivent rester dans la documentation, pas dans le plaisir de découverte.
