// PELAGIC — sonification locale (Web Audio API, aucune ressource externe).
// Auteur : CLAUDE. Chaque balise est un petit carillon : la hauteur dépend de
// sa position verticale (gamme pentatonique), la stéréo de sa position
// horizontale. Une chaîne délai + filtre donne la profondeur « sous-marine ».

/** Gamme pentatonique mineure sur 3 octaves, en demi-tons depuis la base. */
const SCALE = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24, 27, 29, 31, 34];
const BASE_FREQ = 110; // La2

/**
 * Convertit une position verticale normalisée (0 = haut) en fréquence.
 * Les balises hautes sonnent aigu, les balises profondes sonnent grave.
 * @param {number} y position normalisée [0,1]
 * @returns {number} fréquence en Hz
 */
export function pitchForDepth(y) {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(y) ? y : 0.5));
  const index = Math.round((1 - clamped) * (SCALE.length - 1));
  return BASE_FREQ * 2 ** (SCALE[index] / 12);
}

/** Nom lisible de la note (pour l'interface et l'accessibilité). */
export function noteName(freq, lang = 'fr') {
  const names = lang === 'en'
    ? ['A', 'A♯', 'B', 'C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯']
    : ['La', 'La♯', 'Si', 'Do', 'Do♯', 'Ré', 'Ré♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯'];
  const semis = Math.round(12 * Math.log2(freq / BASE_FREQ));
  const octave = 2 + Math.floor((semis + 9) / 12);
  return `${names[((semis % 12) + 12) % 12]}${octave}`;
}

/**
 * Crée le moteur audio. L'AudioContext n'est instancié qu'au premier geste
 * utilisateur (politique d'autoplay des navigateurs).
 */
export function createAudio() {
  let ctx = null;
  let master = null;
  let enabled = false;
  let volume = 0.6;
  let voices = 0;
  const MAX_VOICES = 24;

  function ensure() {
    if (ctx) return true;
    const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Ctor) return false;
    try {
      ctx = new Ctor();
    } catch {
      return false;
    }
    master = ctx.createGain();
    master.gain.value = volume;

    // Écho sous-marin : délai filtré réinjecté.
    const delay = ctx.createDelay(2);
    delay.delayTime.value = 0.42;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.38;
    const damp = ctx.createBiquadFilter();
    damp.type = 'lowpass';
    damp.frequency.value = 1800;
    const wet = ctx.createGain();
    wet.gain.value = 0.45;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 4;

    master.connect(comp);
    master.connect(delay);
    delay.connect(damp);
    damp.connect(feedback);
    feedback.connect(delay);
    damp.connect(wet);
    wet.connect(comp);
    comp.connect(ctx.destination);
    return true;
  }

  return {
    get supported() {
      return Boolean(globalThis.AudioContext || globalThis.webkitAudioContext);
    },
    get enabled() {
      return enabled;
    },
    /** Active le son (doit être appelé dans un gestionnaire d'événement). */
    async enable() {
      if (!ensure()) return false;
      if (ctx.state === 'suspended') {
        try {
          await ctx.resume();
        } catch {
          return false;
        }
      }
      enabled = true;
      return true;
    },
    disable() {
      enabled = false;
      if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {});
    },
    setVolume(v) {
      volume = Math.min(1, Math.max(0, Number(v) || 0));
      if (master) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.05);
    },
    /**
     * Joue un carillon.
     * @param {number} freq fréquence
     * @param {number} velocity intensité [0,1]
     * @param {number} pan stéréo [-1,1]
     */
    chime(freq, velocity = 0.5, pan = 0) {
      if (!enabled || !ctx || ctx.state !== 'running' || voices >= MAX_VOICES) return false;
      const t = ctx.currentTime;
      const v = Math.min(1, Math.max(0.05, velocity));
      const out = ctx.createGain();
      out.gain.setValueAtTime(0.0001, t);
      out.gain.exponentialRampToValueAtTime(0.22 * v, t + 0.012);
      out.gain.exponentialRampToValueAtTime(0.0001, t + 1.6 + v);

      // Synthèse FM douce : porteuse sinus + modulante au ratio 3.5 (timbre de verre).
      const carrier = ctx.createOscillator();
      carrier.type = 'sine';
      carrier.frequency.value = freq;
      const mod = ctx.createOscillator();
      mod.frequency.value = freq * 3.5;
      const modGain = ctx.createGain();
      modGain.gain.setValueAtTime(freq * 1.4 * v, t);
      modGain.gain.exponentialRampToValueAtTime(1, t + 0.6);
      mod.connect(modGain);
      modGain.connect(carrier.frequency);

      let node = out;
      if (ctx.createStereoPanner) {
        const panner = ctx.createStereoPanner();
        panner.pan.value = Math.min(1, Math.max(-1, pan));
        out.connect(panner);
        node = panner;
      }
      carrier.connect(out);
      node.connect(master);

      const end = t + 2.8 + v;
      carrier.start(t);
      mod.start(t);
      carrier.stop(end);
      mod.stop(end);
      voices += 1;
      carrier.onended = () => {
        voices -= 1;
        try {
          node.disconnect();
          out.disconnect();
        } catch {
          /* déjà déconnecté */
        }
      };
      return true;
    },
  };
}
