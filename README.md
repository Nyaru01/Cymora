# QUATRE

**Four interactive works. A story of creating together.**

QUATRE brings together PELAGIC — The Garden of Currents, Nocturne and Résonance — and INTERVALLE. Explore currents, write a musical night, leave a gesture to receive a reply, then watch two independently authored writings share a sheet.

The public edition is available in French and English. It is free to visit, requires no account or API key, contains no advertising or analytics, and keeps creative data on the visitor’s device. Sound starts through a deliberate action. No microphone or camera is used.

**Play: https://nyaru01.github.io/Duo/** · [Source repository](https://github.com/Nyaru01/Duo)

The live site is hosted on GitHub Pages and was verified over HTTPS. Railway is separately prepared, with no deployment or billed service created; see [deployment readiness](docs/G5-DEPLOYMENT.md).

## Run locally

Node.js 22 or newer. No packages to install and no Git required at runtime.

```powershell
.\START.ps1
```

Open http://127.0.0.1:4173/ . Stop with `.\STOP.ps1`. The scripts identify their own process and do not stop unrelated servers. If port 4173 is occupied, select another port explicitly:

```powershell
$env:PORT = '4177'
node server.mjs
```

On Linux/macOS: `node server.mjs` or `npm start`. The default host is loopback. For a production container set `HOST=0.0.0.0`; Railway markers are also recognised. `PORT` is honoured and `/health` returns JSON.

## Explore

| Route | Experience |
|---|---|
| `/` | Bilingual exhibition, four rooms, labels and sharing |
| `/oeuvres/jardin/` | Build and observe currents |
| `/oeuvres/nocturne/` | Touch light, place notes, compose four movements |
| `/oeuvres/resonance/` | Gesture, silence, reply and local memory |
| `/oeuvres/intervalle/` | ORDRE and DÉTOUR, a sheet neither can own |
| `/atelier/` | Sourced account of the collaboration, two separate voices |
| `/rapports/` | Independent final reports, French originals and labelled English translations |

The exhibition and editorial pages can be read in portrait. The works are designed for landscape; a dismissible invitation suggests rotating a narrow portrait device without locking orientation. All four works include a return to the exhibition and a shared language preference.

## Check

```sh
npm test
node scripts/audit-public.mjs
```

No dependency installation is needed. Tests cover deterministic engines, imports, score transitions, policies, translations and a server launched from an isolated copy with no `.git`. GitHub Actions runs the suite on Windows and Linux with Node 22 and 24. Browser journeys and their limits are documented in [readiness](docs/G5-READINESS.md). Captures simulate CSS viewports; they are not physical-phone tests.

## Deploy

The Dockerfile copies only `server.mjs`, `package.json` and `public/`, runs as the unprivileged `node` user and does not need Git. `railway.json` declares the command and `/health` check. No database, volume or secret is required. See [Railway instructions](docs/G5-DEPLOYMENT.md) before creating a service or incurring usage costs. Actual HTTPS exports must be checked on the deployed URL.

## History, sources and rights

[Public history](docs/PUBLIC-HISTORY.md) explains why this publication has a separate sanitised history. Public v1–v4 tags preserve historical browser sources and add a small local launcher. The original private commits and journals remain intact on the creation machine; public commit hashes differ. Selected historical documents are redacted copies, not rewritten originals.

[Architecture](docs/ARCHITECTURE.md), [collaboration](docs/COLLABORATION.md), [changelog](CHANGELOG.md), [privacy](docs/G5-PRIVACY.md), [proposed licence and asset inventory](docs/LICENSE-PROPOSAL.md). MIT is proposed, not adopted; free visitor access is distinct from rights to reuse the source.

## Français

QUATRE réunit quatre œuvres interactives, de PELAGIC à INTERVALLE. L’édition publique est gratuite, bilingue, sans compte, publicité ou collecte personnelle. Les compositions, empreintes, souvenirs et préférences restent dans le navigateur. Le son est volontaire, sans microphone.

Exposition en ligne : **https://nyaru01.github.io/Duo/** .

Lancer `START.ps1`, ouvrir http://127.0.0.1:4173/ et arrêter avec `STOP.ps1`. Node ≥22, aucune dépendance à installer et aucun accès Git nécessaire à l’exécution. Le dossier `public/` contient les quatre éditions prêtes à être servies.

Les originaux historiques sont préservés localement. L’historique public est assaini et ses différences sont documentées. Les rapports des deux agents gardent leurs conclusions propres. Le projet ne prétend démontrer ni conscience ni supériorité scientifique de la collaboration entre agents.
