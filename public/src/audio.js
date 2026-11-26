// PELAGIC V2 — sonification locale (Web Audio API, aucune ressource externe).
// Auteur : CLAUDE. Quatre voix synthétisées, quatre gammes, scintillement des
// flashes de plancton, et enregistrement de la sortie en fichier local.

/** Gammes en demi-tons sur une octave. */
export const SCALES = Object.freeze({
  pentatonic: [0, 3, 5, 7, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  insen: [0, 1, 5, 7, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
});
export const SCALE_LABELS = Object.freeze({
  pentatonic: 'Pentatonique',
  dorian: 'Dorien',
  insen: 'In-sen',
  lydian: 'Lydien',
});
export const VOICES = Object.freeze(['glass', 'bell', 'pluck', 'breath']);
export const VOICE_LABELS = Object.freeze({ glass: 'Verre', bell: 'Cloche des abysses', pluck: 'Pizzicato', breath: 'Souffle' });

// Alias français acceptés (le moteur stocke les clés anglaises canoniques).
const SCALE_ALIASES = { pentatonique: 'pentatonic', dorien: 'dorian', lydien: 'lydian' };
const VOICE_ALIASES = { verre: 'glass', abysse: 'bell', pizz: 'pluck', souffle: 'breath' };
const own = (o, k) => typeof k === 'string' && Object.hasOwn(o, k);
export const canonicalScale = (s) => {
  const k = own(SCALE_ALIASES, s) ? SCALE_ALIASES[s] : s;
  return own(SCALES, k) ? k : 'pentatonic';
};
export const canonicalVoice = (v) => {
  const k = own(VOICE_ALIASES, v) ? VOICE_ALIASES[v] : v;
  return VOICES.includes(k) ? k : 'glass';
};

const BASE_FREQ = 110; // La2
const OCTAVES = 3;

/** Degrés de la gamme sur trois octaves (+ la tonique finale). */
export function scaleSteps(scale = 'pentatonic') {
  const steps = SCALES[canonicalScale(scale)];
  const out = [];
  for (let o = 0; o < OCTAVES; o++) for (const s of steps) out.push(s + 12 * o);
  out.push(12 * OCTAVES);
  return out;
}

/**
 * Profondeur normalisée → fréquence (0 = surface = aigu).
 * @param {number} y position [0,1]
 * @param {string} scale clé de SCALES
 */
export function pitchForDepth(y, scale = 'pentatonic') {
  const steps = scaleSteps(scale);
  const clamped = Math.min(1, Math.max(0, Number.isFinite(y) ? y : 0.5));
  const index = Math.round((1 - clamped) * (steps.length - 1));
  return BASE_FREQ * 2 ** (steps[index] / 12);
}

/** Nom lisible de la note (pour l'interface et l'accessibilité). */
export function noteName(freq) {
  const names = ['La', 'La♯', 'Si', 'Do', 'Do♯', 'Ré', 'Ré♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯'];
  const semis = Math.round(12 * Math.log2(freq / BASE_FREQ));
  const octave = 2 + Math.floor((semis + 9) / 12);
  return `${names[((semis % 12) + 12) % 12]}${octave}`;
}

/** Choisit un format d'enregistrement pris en charge (ou null). */
export function pickRecordingType(isSupported) {
  const candidates = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/mp4'];
  for (const t of candidates) {
    try {
      if (isSupported(t)) return t;
    } catch { /* navigateur restrictif */ }
  }
  return null;
}

/**
 * Couleurs du bourdon par chapitre. ratio : quatrième voix, toujours une note de la gamme du jeu
 * (la mineur pentatonique : la, do, ré, mi, sol) pour rester en accord avec le chant.
 */
const TONES = Object.freeze({
  see: { ratio: 3, amp: 0.1, cutoff: 560, breath: 0.07 },          // mi aigu : clair, l'aube
  follow: { ratio: 1.335, amp: 0.14, cutoff: 680, breath: 0.08 },  // ré : suspendu, en mouvement
  remember: { ratio: 1.189, amp: 0.16, cutoff: 470, breath: 0.06 },// do : la tierce mineure, la mémoire
  listen: { ratio: 4, amp: 0.06, cutoff: 380, breath: 0.045 },     // très doux, presque rien : la nuit
  pulse: { ratio: 1.782, amp: 0.12, cutoff: 640, breath: 0.1 },    // sol : chaud, le cœur qui bat
  resonate: { ratio: 2.67, amp: 0.13, cutoff: 760, breath: 0.08 }, // ré aigu, plus ouvert : tout résonne
  daily: { ratio: 2.67, amp: 0.09, cutoff: 600, breath: 0.07 },    // ré aigu : la résonance du jour
  free: { ratio: 2, amp: 0.05, cutoff: 520, breath: 0.07 },        // l'octave : neutre
});

/** Réponse impulsionnelle synthétique : bruit stéréo qui s'éteint, adouci (réverbération sans fichier). */
function impulse(ctx, seconds, decay) {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(2, len, rate);
  let seed = 987654321;
  for (let c = 0; c < 2; c++) {
    const data = buf.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const n = (seed / 4294967296) * 2 - 1;
      lp += (n - lp) * (0.35 - 0.25 * (i / len)); // plus sourde en fin de queue
      data[i] = lp * (1 - i / len) ** decay;
    }
  }
  return buf;
}

/**
 * Crée le moteur audio. L'AudioContext n'est instancié qu'au premier geste
 * utilisateur (politique d'autoplay des navigateurs).
 */
export function createAudio() {
  let ctx = null;
  let master = null;
  let bus = null; // sortie finale (compresseur), branchée sur les haut-parleurs et l'enregistreur
  let enabled = false;
  let volume = 0.6;
  let voices = 0;
  let noise = null;
  let lastShimmer = 0;
  let recorder = null;
  let recordStream = null;
  let chunks = [];
  let drone = null;
  let toneId = 'free';
  const MAX_VOICES = 40;

  /** Applique la couleur d'un chapitre au bourdon, en glissant (ou d'un coup au démarrage). */
  function applyTone(d, id, instant) {
    const p = TONES[id] ?? TONES.free;
    const t = ctx.currentTime;
    const tc = instant ? 0.01 : 1.6;
    d.lp.frequency.setTargetAtTime(p.cutoff, t, tc);
    d.breath.frequency.setTargetAtTime(p.breath, t, tc);
    d.color.frequency.setTargetAtTime(d.root * p.ratio, t, instant ? 0.01 : 0.9);
    d.colorGain.gain.setTargetAtTime(Math.max(0.0001, p.amp), t, tc);
  }

  function ensure() {
    if (ctx) return true;
    const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Ctor) return false;
    try {
      ctx = new Ctor({ latencyHint: 'interactive' });
    } catch {
      return false;
    }
    master = ctx.createGain();
    master.gain.value = volume;

    // Écho sous-marin : délai filtré réinjecté, légèrement modulé (houle).
    const delay = ctx.createDelay(2);
    delay.delayTime.value = 0.42;
    const wobble = ctx.createOscillator();
    wobble.frequency.value = 0.13;
    const wobbleDepth = ctx.createGain();
    wobbleDepth.gain.value = 0.004;
    wobble.connect(wobbleDepth);
    wobbleDepth.connect(delay.delayTime);
    wobble.start();
    const feedback = ctx.createGain();
    feedback.gain.value = 0.3;
    const damp = ctx.createBiquadFilter();
    damp.type = 'lowpass';
    damp.frequency.value = 1700;
    const wet = ctx.createGain();
    wet.gain.value = 0.3;

    bus = ctx.createDynamicsCompressor();
    bus.threshold.value = -18;
    bus.ratio.value = 4;

    master.connect(bus);
    master.connect(delay);
    delay.connect(damp);
    damp.connect(feedback);
    feedback.connect(delay);
    damp.connect(wet);
    wet.connect(bus);
    // Réverbération : une salle d'eau et de lumière (~3,4 s), en parallèle de l'écho.
    const reverb = ctx.createConvolver();
    reverb.buffer = impulse(ctx, 3.4, 2.4);
    const reverbGain = ctx.createGain();
    reverbGain.gain.value = 0.3;
    master.connect(reverb);
    reverb.connect(reverbGain);
    reverbGain.connect(bus);
    bus.connect(ctx.destination);

    // Bruit blanc partagé (breath, scintillement).
    const len = ctx.sampleRate * 2;
    noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noise.getChannelData(0);
    let seed = 1234567;
    for (let i = 0; i < len; i++) {
      seed = (seed * 1103515245 + 12345) >>> 0;
      data[i] = (seed / 4294967296) * 2 - 1;
    }
    return true;
  }

  function output(pan) {
    const out = ctx.createGain();
    let node = out;
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.min(1, Math.max(-1, pan));
      out.connect(p);
      node = p;
    }
    node.connect(master);
    return { out, node };
  }

  function track(source, nodes) {
    voices += 1;
    source.onended = () => {
      voices -= 1;
      for (const n of nodes) {
        try { n.disconnect(); } catch { /* déjà déconnecté */ }
      }
    };
  }

  function env(param, t, peak, attack, release) {
    param.setValueAtTime(0.0001, t);
    param.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    param.exponentialRampToValueAtTime(0.0001, t + attack + release);
  }

  const synth = {
    // Verre : FM douce, rapport 3,5.
    glass(freq, v, t, pan) {
      const { out, node } = output(pan);
      env(out.gain, t, 0.22 * v, 0.012, 1.6 + v);
      const car = ctx.createOscillator();
      car.frequency.value = freq;
      const mod = ctx.createOscillator();
      mod.frequency.value = freq * 3.5;
      const mg = ctx.createGain();
      mg.gain.setValueAtTime(freq * 1.4 * v, t);
      mg.gain.exponentialRampToValueAtTime(1, t + 0.6);
      mod.connect(mg);
      mg.connect(car.frequency);
      car.connect(out);
      // Une seconde voix à peine désaccordée (scintillement naturel) et une sous-octave très douce.
      const twin = ctx.createOscillator();
      twin.frequency.value = freq;
      twin.detune.value = 7;
      const tg = ctx.createGain();
      tg.gain.value = 0.35;
      twin.connect(tg);
      tg.connect(out);
      const sub = ctx.createOscillator();
      sub.frequency.value = freq / 2;
      const sg = ctx.createGain();
      sg.gain.value = 0.12;
      sub.connect(sg);
      sg.connect(out);
      const end = t + 2.8 + v;
      for (const o of [car, mod, twin, sub]) { o.start(t); o.stop(end); }
      track(car, [car, mod, mg, twin, tg, sub, sg, out, node]);
    },
    // Cloche des bells : partiels inharmoniques, une octave plus bas.
    bell(freq, v, t, pan) {
      const { out, node } = output(pan);
      out.gain.value = 1;
      const f0 = freq / 2;
      const partials = [[1, 1, 4.5], [2.76, 0.5, 2.6], [5.4, 0.28, 1.4], [8.93, 0.12, 0.8]];
      const oscs = [];
      for (const [ratio, amp, decay] of partials) {
        const o = ctx.createOscillator();
        o.frequency.value = f0 * ratio;
        const g = ctx.createGain();
        env(g.gain, t, 0.16 * v * amp, 0.004, decay);
        o.connect(g);
        g.connect(out);
        o.start(t);
        o.stop(t + decay + 0.1);
        oscs.push(o, g);
      }
      track(oscs[0], [...oscs, out, node]);
    },
    // Pizzicato : dent de scie filtrée, attaque sèche.
    pluck(freq, v, t, pan) {
      const { out, node } = output(pan);
      env(out.gain, t, 0.2 * v, 0.003, 0.45);
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = freq;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.Q.value = 6;
      f.frequency.setValueAtTime(freq * 8, t);
      f.frequency.exponentialRampToValueAtTime(freq * 1.2, t + 0.3);
      o.connect(f);
      f.connect(out);
      o.start(t);
      o.stop(t + 0.6);
      track(o, [o, f, out, node]);
    },
    // Souffle : bruit filtré en bande étroite, attaque lente (nappe).
    breath(freq, v, t, pan) {
      const { out, node } = output(pan);
      out.gain.setValueAtTime(0.0001, t);
      out.gain.exponentialRampToValueAtTime(0.5 * v, t + 0.35);
      out.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = freq * 2;
      bp.Q.value = 28;
      const tone = ctx.createOscillator();
      tone.frequency.value = freq;
      const tg = ctx.createGain();
      tg.gain.value = 0.04;
      src.connect(bp);
      bp.connect(out);
      tone.connect(tg);
      tg.connect(out);
      src.start(t, Math.random() * 1.5);
      tone.start(t);
      src.stop(t + 2.5);
      tone.stop(t + 2.5);
      track(src, [src, bp, tone, tg, out, node]);
    },
  };

  return {
    get supported() {
      return Boolean(globalThis.AudioContext || globalThis.webkitAudioContext);
    },
    get enabled() {
      return enabled;
    },
    get now() {
      return ctx ? ctx.currentTime : 0;
    },
    get recording() {
      return Boolean(recorder && recorder.state === 'recording');
    },
    get canRecord() {
      return Boolean(globalThis.MediaRecorder && (globalThis.AudioContext || globalThis.webkitAudioContext));
    },
    /** Active le son (doit être appelé dans un gestionnaire d'événement). */
    async enable() {
      if (!ensure()) return false;
      if (ctx.state === 'suspended') {
        try {
          // Certains navigateurs laissent resume() en suspens : on n'attend pas plus de 1,5 s.
          const ok = await Promise.race([ctx.resume().then(() => true), new Promise((r) => setTimeout(() => r(false), 1500))]);
          if (!ok || ctx.state !== 'running') return false;
        } catch {
          return false;
        }
      }
      enabled = true;
      return true;
    },
    disable() {
      enabled = false;
      if (this.recording) return; // on ne coupe pas un enregistrement en cours
      if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {});
    },
    setVolume(v) {
      volume = Math.min(1, Math.max(0, Number(v) || 0));
      if (master) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.05);
    },
    /**
     * Joue une note.
     * @param {number} freq fréquence
     * @param {object} o { velocity 0..1, pan -1..1, voice, delay (s) }
     */
    note(freq, { velocity = 0.5, pan = 0, voice = 'glass', delay = 0 } = {}) {
      if (!enabled || !ctx || ctx.state !== 'running' || voices >= MAX_VOICES) return false;
      if (!Number.isFinite(freq) || freq <= 0) return false;
      const v = Math.min(1, Math.max(0.05, velocity));
      const t = ctx.currentTime + Math.max(0, Math.min(2, delay)) + 0.01;
      synth[canonicalVoice(voice)](freq, v, t, pan);
      return true;
    },
    /**
     * Bourdon : une quinte grave (fondamentale + quinte), très douce, qui respire lentement.
     * Il installe le calme et donne la tonique sans rien imposer. Une seule instance.
     */
    drone(on, root = 110) {
      if (!ctx) return false;
      const t = ctx.currentTime;
      if (!on) {
        if (drone) {
          const d = drone;
          drone = null;
          d.gain.gain.setTargetAtTime(0.0001, t, 0.8);
          setTimeout(() => { for (const n of d.nodes) { try { n.stop?.(); n.disconnect(); } catch { /* déjà arrêté */ } } }, 4000);
        }
        return true;
      }
      if (drone || !enabled) return Boolean(drone);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.setTargetAtTime(0.05, t, 2.5);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 520;
      lp.Q.value = 0.4;
      const breath = ctx.createOscillator();
      breath.frequency.value = 0.07;
      const depth = ctx.createGain();
      depth.gain.value = 0.018;
      breath.connect(depth);
      depth.connect(gain.gain);
      const nodes = [breath, depth, lp, gain];
      for (const [ratio, type, amp, detune] of [[1, 'sine', 0.7, 0], [1.5, 'sine', 0.35, 4], [2, 'triangle', 0.12, -5]]) {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = root * ratio;
        o.detune.value = detune;
        const g = ctx.createGain();
        g.gain.value = amp;
        o.connect(g);
        g.connect(lp);
        o.start(t);
        nodes.push(o, g);
      }
      // La couleur du chapitre : une quatrième voix (toujours une note de la gamme), changée en glissant.
      const color = ctx.createOscillator();
      color.type = 'sine';
      const colorGain = ctx.createGain();
      colorGain.gain.value = 0.0001;
      color.connect(colorGain);
      colorGain.connect(lp);
      color.start(t);
      nodes.push(color, colorGain);
      breath.start(t);
      lp.connect(gain);
      gain.connect(master);
      drone = { gain, nodes, lp, breath, color, colorGain, root };
      applyTone(drone, toneId, true);
      return true;
    },
    /** Couleur sonore du chapitre : le bourdon glisse doucement vers la nouvelle teinte (quelques secondes). */
    tone(id) {
      toneId = own(TONES, id) ? id : 'free';
      if (drone) applyTone(drone, toneId, false);
    },
    /**
     * Éclosion d'une résonance : une nappe soufflée monte sur les notes du chant,
     * quelques éclats aigus retombent, et le bourdon s'enfle un instant.
     */
    bloom(freqs, strength = 1) {
      if (!enabled || !ctx) return;
      const k = Math.min(1, Math.max(0.2, strength));
      freqs.forEach((f, i) => this.note(f, { voice: 'breath', velocity: 0.28 * k, delay: 0.15 + i * 0.12, pan: (i % 2 ? -0.4 : 0.4) }));
      [...freqs].reverse().slice(0, 3).forEach((f, i) => this.note(f * 2, { voice: 'glass', velocity: 0.16 * k, delay: 0.9 + i * 0.22, pan: (i - 1) * 0.5 }));
      if (drone) {
        const t = ctx.currentTime;
        drone.gain.gain.cancelScheduledValues(t);
        drone.gain.gain.setTargetAtTime(0.05 * (1 + 0.8 * k), t, 0.6);
        drone.gain.gain.setTargetAtTime(0.05, t + 2.2, 1.6);
      }
    },
    /** Glissade : une voix douce dont la hauteur glisse d'une note à l'autre (atelier Glisser). */
    glide(from, to, seconds, { velocity = 0.3, pan = 0, delay = 0 } = {}) {
      if (!enabled || !ctx || ctx.state !== 'running' || voices >= MAX_VOICES) return false;
      const t = ctx.currentTime + Math.max(0, Math.min(2, delay)) + 0.01;
      const dur = Math.max(0.2, seconds);
      const { out, node } = output(pan);
      out.gain.setValueAtTime(0.0001, t);
      out.gain.exponentialRampToValueAtTime(0.16 * velocity, t + 0.12);
      out.gain.setTargetAtTime(0.0001, t + dur, 0.25);
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(from, t);
      o.frequency.exponentialRampToValueAtTime(to, t + dur);
      const o2 = ctx.createOscillator();
      o2.frequency.setValueAtTime(from * 2, t);
      o2.frequency.exponentialRampToValueAtTime(to * 2, t + dur);
      const g2 = ctx.createGain();
      g2.gain.value = 0.18;
      o.connect(out);
      o2.connect(g2);
      g2.connect(out);
      for (const x of [o, o2]) { x.start(t); x.stop(t + dur + 1.2); }
      track(o, [o, o2, g2, out, node]);
      return true;
    },
    /** Accord de résolution : les notes du motif ensemble, égrenées comme une harpe lente. */
    chord(freqs, { velocity = 0.4, voice = 'bell', spread = 0.07 } = {}) {
      let k = 0;
      for (const f of freqs) this.note(f, { velocity, voice, delay: k++ * spread, pan: (k % 2 ? -0.3 : 0.3) });
    },
    /** Compatibilité V1. */
    chime(freq, velocity = 0.5, pan = 0) {
      return this.note(freq, { velocity, pan, voice: 'glass' });
    },
    /**
     * Scintillement des flashes de plancton : grains aigus très doux, dont
     * la densité suit le nombre de déclenchements (limité à ~12 grains/s).
     */
    shimmer(intensity, pan = 0) {
      if (!enabled || !ctx || ctx.state !== 'running' || voices >= MAX_VOICES - 4) return false;
      const k = Math.min(1, Math.max(0, intensity));
      if (k < 0.02 || ctx.currentTime - lastShimmer < 0.08) return false;
      lastShimmer = ctx.currentTime;
      const t = ctx.currentTime + 0.005;
      const { out, node } = output(pan);
      env(out.gain, t, 0.05 * k, 0.01, 0.25);
      const src = ctx.createBufferSource();
      src.buffer = noise;
      const hp = ctx.createBiquadFilter();
      hp.type = 'bandpass';
      hp.frequency.value = 5200 + Math.random() * 3000;
      hp.Q.value = 12;
      src.connect(hp);
      hp.connect(out);
      src.start(t, Math.random() * 1.5);
      src.stop(t + 0.3);
      track(src, [src, hp, out, node]);
      return true;
    },
    /** Démarre l'enregistrement de la sortie audio (renvoie false si impossible). */
    startRecording() {
      if (!enabled || !ctx || this.recording || !globalThis.MediaRecorder) return false;
      const type = pickRecordingType((t) => MediaRecorder.isTypeSupported(t));
      if (!recordStream) {
        recordStream = ctx.createMediaStreamDestination();
        bus.connect(recordStream);
      }
      chunks = [];
      try {
        recorder = new MediaRecorder(recordStream.stream, type ? { mimeType: type } : undefined);
      } catch {
        recorder = null;
        return false;
      }
      recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      recorder.start(500);
      return true;
    },
    /** Arrête l'enregistrement et renvoie le fichier (Blob) ou null. */
    stopRecording() {
      return new Promise((resolve) => {
        if (!recorder || recorder.state === 'inactive') {
          resolve(null);
          return;
        }
        const rec = recorder;
        rec.onstop = () => {
          const blob = chunks.length ? new Blob(chunks, { type: rec.mimeType || 'audio/webm' }) : null;
          chunks = [];
          recorder = null;
          resolve(blob);
        };
        rec.stop();
      });
    },
  };
}
