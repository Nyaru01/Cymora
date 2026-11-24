// PELAGIC I — Le jardin des courants : textes FR/EN de l'édition publique. Auteur : CLAUDE.
//
// Deux tables explicites :
//  - DICT : l'interface statique (data-i18n), par clés ;
//  - PHRASES / PATTERNS : les messages dynamiques du moteur et de l'atelier, traduits au point unique
//    où ils sont affichés (say, toast, inspecteur, atlas). Le français reste la langue d'écriture de V1 ;
//    toute phrase absente de ces tables resterait en français, et le test le vérifie.

export const DICT = {
  fr: {
    'meta.title': 'Le jardin des courants — PELAGIC I',
    home: 'Exposition', 'home.label': 'Retour à l’exposition QUATRE', skip: 'Aller aux commandes',
    tag: 'le jardin des courants', ready: 'Choisissez un outil, puis touchez l’océan. Ou ouvrez une composition de l’Atlas.',
    'ocean.label': 'Océan simulé. Touchez pour placer l’élément de l’outil actif.',
    'insp.label': 'Élément sélectionné', 'insp.close': 'Fermer l’inspecteur', 'insp.flip': 'Inverser', 'insp.delete': 'Retirer',
    'immersive.exit': 'Quitter l’immersion',
    'tools.label': 'Outils', 'tools.active': 'Outil actif',
    vortex: 'Tourbillon', source: 'Source', reef: 'Récif', beacon: 'Balise', move: 'Déplacer', erase: 'Effacer',
    'panel.label': 'Carnet de bord', 'panel.open': 'Carnet', 'panel.close': 'Fermer le carnet',
    log: 'Carnet de bord', particles: 'Particules', speed: 'Vitesse moy.', nodes: 'Éléments', notes: 'Passages captés', time: 'Temps simulé', fps: 'Images/s',
    atlas: 'Atlas', 'atlas.lede': 'Six compositions à écouter, à démonter, à détourner.', 'atlas.label': 'Compositions de l’Atlas',
    settings: 'Réglages', 'set.speed': 'Vitesse du courant', 'set.turb': 'Turbulence', 'set.count': 'Plancton', 'set.trail': 'Persistance des traînées',
    sound: 'Son', 'sound.on': 'Activer le son', volume: 'Volume',
    dive: 'Plongée', pause: 'Pause', respawn: 'Relâcher le plancton', undo: 'Annuler', redo: 'Rétablir', immersive: 'Immersion', photo: 'Photographier',
    clear: 'Vider l’océan', help: 'Aide', share: 'Partager', export: 'Exporter .json', import: 'Importer…', link: 'Copier un lien',
    'help.title': 'Bienvenue à bord',
    'help.lede': 'Pelagic est un jardin de courants. Des milliers de grains de plancton lumineux dérivent dans un champ de forces que vous composez.',
    'help.vortex': 'Tourbillon — fait tourner le plancton. Une force négative tourne dans l’autre sens.',
    'help.source': 'Source — repousse le plancton (force négative : l’aspire).',
    'help.reef': 'Récif — obstacle que le courant contourne.',
    'help.beacon': 'Balise — chante chaque fois que du plancton la traverse. Plus elle est haute, plus la note est aiguë ; à gauche ou à droite, elle sonne dans l’oreille correspondante.',
    'help.move': 'Avec Déplacer, faites glisser un élément ; touchez-le pour régler sa force dans l’inspecteur. Effacer le retire.',
    'help.keys': 'Clavier : 1–6 outils · Espace pause · R plancton · M son · F immersion · P photo · Ctrl+Z annuler · ? aide',
    'help.note': 'Simulation artistique, sans valeur de prévision océanographique. Tout fonctionne hors ligne, rien ne quitte votre appareil.',
    'help.go': 'Plonger',
    'rotate.note': '',
  },
  en: {
    'meta.title': 'The Garden of Currents — PELAGIC I',
    home: 'Exhibition', 'home.label': 'Back to the QUATRE exhibition', skip: 'Skip to controls',
    tag: 'the garden of currents', ready: 'Choose a tool, then touch the ocean. Or open a composition from the Atlas.',
    'ocean.label': 'Simulated ocean. Touch to place the active tool’s element.',
    'insp.label': 'Selected element', 'insp.close': 'Close the inspector', 'insp.flip': 'Reverse', 'insp.delete': 'Remove',
    'immersive.exit': 'Leave immersion',
    'tools.label': 'Tools', 'tools.active': 'Active tool',
    vortex: 'Vortex', source: 'Source', reef: 'Reef', beacon: 'Beacon', move: 'Move', erase: 'Erase',
    'panel.label': 'Logbook', 'panel.open': 'Logbook', 'panel.close': 'Close the logbook',
    log: 'Logbook', particles: 'Particles', speed: 'Mean speed', nodes: 'Elements', notes: 'Passes heard', time: 'Simulated time', fps: 'Frames/s',
    atlas: 'Atlas', 'atlas.lede': 'Six compositions to listen to, take apart, and repurpose.', 'atlas.label': 'Atlas compositions',
    settings: 'Settings', 'set.speed': 'Current speed', 'set.turb': 'Turbulence', 'set.count': 'Plankton', 'set.trail': 'Trail persistence',
    sound: 'Sound', 'sound.on': 'Turn sound on', volume: 'Volume',
    dive: 'Dive', pause: 'Pause', respawn: 'Release plankton', undo: 'Undo', redo: 'Redo', immersive: 'Immersion', photo: 'Take a photo',
    clear: 'Empty the ocean', help: 'Help', share: 'Share', export: 'Export .json', import: 'Import…', link: 'Copy a link',
    'help.title': 'Welcome aboard',
    'help.lede': 'Pelagic is a garden of currents. Thousands of grains of glowing plankton drift in a field of forces that you compose.',
    'help.vortex': 'Vortex — spins the plankton. A negative force turns the other way.',
    'help.source': 'Source — pushes the plankton away (negative force: draws it in).',
    'help.reef': 'Reef — an obstacle the current flows around.',
    'help.beacon': 'Beacon — sings each time plankton crosses it. The higher it sits, the higher the note; left or right, it sounds in that ear.',
    'help.move': 'With Move, drag an element; touch it to set its force in the inspector. Erase removes it.',
    'help.keys': 'Keyboard: 1–6 tools · Space pause · R plankton · M sound · F immersion · P photo · Ctrl+Z undo · ? help',
    'help.note': 'An artistic simulation with no oceanographic forecasting value. Everything works offline; nothing leaves your device.',
    'help.go': 'Dive in',
    'rotate.note': '',
  },
};

/** Phrases exactes (français → anglais). */
export const PHRASES = {
  'Rien à annuler.': 'Nothing to undo.',
  'Rien à rétablir.': 'Nothing to redo.',
  'Rétabli.': 'Redone.',
  'PROFONDEUR': 'DEPTH', 'COURANT DOMINANT →': 'PREVAILING CURRENT →',
  'Canevas actif : flèches pour viser, Entrée pour placer, Suppr pour retirer, + / − pour la force.': 'Canvas focused: arrows to aim, Enter to place, Delete to remove, + / − for force.',
  'Touchez l’océan pour créer un tourbillon (Maj : sens inverse).': 'Touch the ocean to create a vortex (Shift: reverse direction).',
  'Touchez l’océan pour créer une source (Maj : un puits qui aspire).': 'Touch the ocean to create a source (Shift: a sink that draws in).',
  'Touchez l’océan pour poser un récif.': 'Touch the ocean to place a reef.',
  'Posez une balise sur le trajet du plancton : elle chantera à chaque passage.': 'Place a beacon in the plankton’s path: it will sing at every pass.',
  'Faites glisser un élément, ou molette dessus pour régler sa force.': 'Drag an element, or scroll over it to set its force.',
  'Touchez un élément pour le retirer.': 'Touch an element to remove it.',
  'Son indisponible dans ce navigateur': 'Sound unavailable in this browser',
  'Activer le son ': 'Turn sound on ',
  'Son actif ': 'Sound on ',
  'Son coupé.': 'Sound off.',
  'Le navigateur a refusé de démarrer l’audio.': 'The browser refused to start audio.',
  'Son actif : écoutez vos balises.': 'Sound on: listen to your beacons.',
  'Son actif. Posez une balise (4) pour entendre le plancton.': 'Sound on. Place a beacon (4) to hear the plankton.',
  'Reprendre ': 'Resume ',
  'Pause ': 'Pause ',
  'Courants figés.': 'Currents frozen.',
  'Les courants reprennent.': 'The currents resume.',
  'Nouveau plancton relâché.': 'New plankton released.',
  'L’océan est déjà vide.': 'The ocean is already empty.',
  'Éléments restaurés.': 'Elements restored.',
  'Composition précédente restaurée.': 'Previous composition restored.',
  'Photo impossible dans ce navigateur.': 'Photos are not possible in this browser.',
  'Photographie de l’océan enregistrée.': 'Photo of the ocean saved.',
  'Immersion : F ou Échap pour revenir.': 'Immersion: F or Esc to return.',
  'Composition exportée.': 'Composition exported.',
  'Fichier trop volumineux (32 Ko maximum).': 'File too large (32 KB maximum).',
  'Lien copié : il contient toute la composition, rien n’est envoyé sur Internet.': 'Link copied: it contains the whole composition; nothing is sent over the Internet.',
  'Presse-papiers indisponible : le lien est dans la barre d’adresse.': 'Clipboard unavailable: the link is in the address bar.',
  'Composition partagée chargée depuis le lien.': 'Shared composition loaded from the link.',
  'Votre dernière plongée a été restaurée.': 'Your last dive has been restored.',
  'Mouvement réduit détecté : les courants attendent. Espace pour les lancer.': 'Reduced motion detected: the currents are waiting. Press Space to start them.',
  'Annuler': 'Undo',
  'Revenir': 'Go back',
  'Le moteur ne répond pas': 'The engine does not respond',
  'Une erreur inattendue est survenue': 'An unexpected error occurred',
  // Moteur et partage
  'Élément invalide.': 'Invalid element.',
  'Maximum : 24 éléments.': 'Maximum: 24 elements.',
  'La population doit être comprise entre 100 et 6000.': 'The population must be between 100 and 6000.',
  'Position invalide.': 'Invalid position.',
  'Réglages invalides.': 'Invalid settings.',
  'Ce fichier ne contient pas un JSON valide.': 'This file does not contain valid JSON.',
  'Format PELAGIC non reconnu.': 'Unrecognised PELAGIC format.',
  'Lien de partage illisible.': 'Unreadable share link.',
  // Inspecteur
  'Élément': 'Element', 'Portée': 'Range', 'Taille': 'Size', 'Force': 'Force',
  'Tourbillon': 'Vortex', 'Source': 'Source', 'Récif': 'Reef', 'Balise': 'Beacon',
  'sens antihoraire': 'counter-clockwise', 'sens horaire': 'clockwise', 'repousse': 'pushes away', 'aspire': 'draws in',
  'obstacle': 'obstacle', 'chante au passage': 'sings as plankton passes',
  // Atlas
  'Le Gyre': 'The Gyre',
  'Deux tourbillons contraires se passent le plancton. Écoutez l’accord qui revient en boucle.': 'Two opposing vortices pass the plankton back and forth. Listen to the chord that keeps returning.',
  'Le Détroit': 'The Strait',
  'Des récifs resserrent le courant dans un chenal. Les balises alignées jouent une gamme descendante.': 'Reefs squeeze the current into a channel. The aligned beacons play a falling scale.',
  'La Fontaine abyssale': 'The Abyssal Fountain',
  'Une source jaillit du fond ; une couronne de balises égrène un arpège à chaque bouffée.': 'A source springs from the deep; a crown of beacons plays an arpeggio with every gust.',
  'Le Puits': 'The Well',
  'Un puits aspire tout. Le plancton spirale vers le centre et traverse les balises de plus en plus vite.': 'A sink draws everything in. The plankton spirals toward the centre and crosses the beacons faster and faster.',
  'L’Allée des tourbillons': 'The Vortex Street',
  'Une rangée de tourbillons alternés, comme derrière un rocher. Le rythme naît de leur alternance.': 'A row of alternating vortices, as behind a rock. The rhythm comes from their alternation.',
  'Page blanche': 'Blank page',
  'Un océan sans aucun élément. À vous de composer.': 'An ocean with no elements. Yours to compose.',
};

/** Messages composés : [motif français, gabarit anglais] ; $1, $2… sont eux-mêmes traduits. */
export const PATTERNS = [
  [/^Annulé \((\d+) étape\(s\) restante\(s\)\)\.$/, 'Undone ($1 step(s) left).'],
  [/^(.+) retiré\.$/, '$1 removed.'],
  [/^(.+)\. Molette pour régler la force\.$/, '$1. Scroll to set the force.'],
  [/^(\d+) grains de plancton relâchés\.$/, '$1 grains of plankton released.'],
  [/^(\d+) élément\(s\) retiré\(s\)\.$/, '$1 element(s) removed.'],
  [/^Composition illisible : (.+)$/, 'Unreadable composition: $1'],
  [/^(.+) chargé\. Activez le son \(M\) pour l’entendre\.$/, '$1 loaded. Turn sound on (M) to hear it.'],
  [/^(.+) chargé\.$/, '$1 loaded.'],
  [/^Export impossible : (.+)$/, 'Export failed: $1'],
  [/^« (.+) » importé : (\d+) élément\(s\)\.$/, '“$1” imported: $2 element(s).'],
  [/^Import refusé : (.+)$/, 'Import refused: $1'],
  [/^Lien ignoré : (.+)$/, 'Link ignored: $1'],
  [/^Impossible de charger src\/engine\.js \((.+)\)\. Lancez l'application avec START\.ps1\.$/, 'Could not load the engine ($1). Please reload the page.'],
  [/^(Tourbillon|Source|Récif|Balise) (\S+) — (.+) — (.+)$/, '$1 $2 — $3 — $4'],
  [/^(Tourbillon|Source|Récif|Balise) (\S+) — (.+)$/, '$1 $2 — $3'],
  [/^(.+) — (.+)$/, '$1 — $2'],
];

const RAW = new Set([3, 4]); // groupes laissés tels quels dans « élément force — effet — position »

/** Traduit une phrase française de V1 vers la langue demandée. */
export function phrase(text, lang) {
  if (lang !== 'en' || typeof text !== 'string' || !text) return text;
  if (text in PHRASES) return PHRASES[text];
  for (const [re, tpl] of PATTERNS) {
    const m = text.match(re);
    if (!m) continue;
    return tpl.replace(/\$(\d)/g, (_, i) => {
      const g = m[Number(i)] ?? '';
      if (re.source.startsWith('^(Tourbillon') && RAW.has(Number(i))) return /^\d/.test(g) ? g : phrase(g, lang);
      return /^\d+(\.\d+)?$/.test(g) ? g : phrase(g, lang);
    });
  }
  return text;
}
