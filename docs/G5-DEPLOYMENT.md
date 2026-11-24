# Préparation Railway / Railway readiness

## État vérifié le 24 novembre 2026

La CLI Railway est authentifiée. Aucun projet ni environnement n’est lié à ce dossier ; aucune ressource n’a été créée, aucun déploiement n’a été effectué. Il n’existe donc pas d’URL Railway vérifiée à livrer. Une connexion à un compte ne constitue pas une autorisation de facturation.

La documentation officielle consultée distingue un plan Free à budget de ressources limité et un Trial temporaire ; l’offre effective du compte et l’environnement cible doivent être confirmés dans Railway avant création d’un service. Sources : https://docs.railway.com/pricing/free-plan et https://docs.railway.com/pricing/plans . Aucun abonnement ni paiement n’a été accepté.

## Déploiement reproductible

- Source : https://github.com/Nyaru01/Duo , branche main.
- Racine du service : dépôt entier. Dockerfile détectable ; railway.json définit le démarrage et /health.
- Commande : node server.mjs. Aucun npm install, compilation ni Git requis au runtime.
- Node ≥22. PORT fourni par Railway est utilisé. Le conteneur définit HOST=0.0.0.0 ; le serveur reconnaît aussi les marqueurs Railway. En lancement Windows normal, le défaut reste 127.0.0.1:4173.
- /health renvoie 200 et {status:"ok",edition:5}. Le contrôle de santé doit réussir avant ouverture du trafic.
- Le conteneur copie uniquement package.json, server.mjs et public/. L’utilisateur est node, sans privilèges root. Aucun volume, secret, compte ou base de données nécessaire.
- Les données créatives restent dans le navigateur. Les exports sont créés sur l’appareil et ne transitent pas par le serveur.

## Étapes restantes pour l’opérateur

1. Choisir un environnement Railway existant ou autoriser explicitement un service et son budget après vérification du plan du compte.
2. Connecter le dépôt cible dans ce service et sélectionner main. Conserver Dockerfile, la commande et /health du dépôt.
3. Déployer, générer un domaine HTTPS si nécessaire, puis vérifier /health et les quatre liens /oeuvres/*/ sur ce domaine.
4. Tester les exports, le partage et la langue sur l’URL HTTPS réelle. Les parcours localhost ne sont pas présentés comme une validation HTTPS.

Ne pas ajouter de clé API ou de service de stockage. Ne pas publier les journaux privés. Ne jamais affirmer que le déploiement a réussi avant un contrôle de l’URL publique.

## English

The CLI is authenticated but this directory is not linked to an authorised Railway environment. No service or deployment was created. The repository is ready for a Docker-based deploy: node server.mjs, Railway PORT, 0.0.0.0 in the container, /health and no Git or dependencies at runtime. Select an authorised service and verify its plan/budget before deployment, then verify its actual HTTPS URL and all four experiences. No Railway URL is claimed.

Technical sources checked: https://docs.railway.com/config-as-code/reference , https://docs.railway.com/builds/dockerfiles , https://docs.railway.com/deployments/healthchecks .
