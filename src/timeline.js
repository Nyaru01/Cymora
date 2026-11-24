// PELAGIC V2 — frise du mode Composer. Auteur : CLAUDE.
// Affiche les quatre mouvements de la partition (score.js, CODEX), la tête
// de lecture et le transport. Aucune logique de partition ici : uniquement
// de la présentation et des rappels vers app.js.

import { atlasPreview } from './atlas.js';

const el = (doc, tag, cls, text) => {
  const e = doc.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

/** Position de la tête (0..1) → mouvement et progression interne. */
export function playheadInfo(phase) {
  const p = ((Number(phase) || 0) % 1 + 1) % 1;
  const index = Math.min(3, Math.floor(p * 4));
  return { index, within: p * 4 - index };
}

/** Mesure et temps (1-indexés) à partir d'un beat. */
export function barBeat(beat, bars) {
  const total = bars * 4;
  const b = ((beat % total) + total) % total;
  return { bar: Math.floor(b / 4) + 1, beat: Math.floor(b % 4) + 1 };
}

/**
 * @param {HTMLElement} root conteneur <section id="score">
 * @param {object} cb rappels : select(i), togglePlay(), toggleLoop(), copyNext(i), setBars(n), rename(i, name), demo()
 */
export function createTimeline(root, cb, doc = globalThis.document) {
  root.replaceChildren();

  const bar = el(doc, 'div', 'score__bar');
  const play = el(doc, 'button', 'btn btn--primary score__play', '▶ Jouer');
  play.type = 'button';
  play.setAttribute('aria-pressed', 'false');
  play.title = 'Lire la partition (Entrée)';
  const loop = el(doc, 'button', 'btn score__loop', '⟲ Boucle');
  loop.type = 'button';
  loop.setAttribute('aria-pressed', 'true');
  const pos = el(doc, 'output', 'score__pos', 'Mesure 1 · 1');
  pos.setAttribute('aria-live', 'off');
  const barsLabel = el(doc, 'label', 'score__bars');
  barsLabel.append('Durée ');
  const bars = el(doc, 'select');
  for (const n of [8, 16, 32]) {
    const o = el(doc, 'option', null, `${n} mesures`);
    o.value = String(n);
    bars.append(o);
  }
  barsLabel.append(bars);
  const copy = el(doc, 'button', 'btn btn--ghost score__copy', 'Copier au suivant');
  copy.type = 'button';
  copy.title = 'Recopier ce mouvement dans le suivant, pour le faire évoluer';
  const demo = el(doc, 'button', 'btn btn--ghost score__demo', '✦ Nocturne');
  demo.type = 'button';
  demo.title = 'Charger « Ce que l’eau garde », la pièce écrite pour PELAGIC (votre partition reste annulable)';
  const rename = el(doc, 'button', 'btn btn--ghost score__rename', 'Renommer');
  rename.type = 'button';
  rename.title = 'Renommer le mouvement sélectionné (F2 sur sa carte)';
  bar.append(play, loop, pos, barsLabel, copy, rename, demo);

  const lane = el(doc, 'ol', 'score__lane');
  lane.setAttribute('aria-label', 'Mouvements de la partition');
  const head = el(doc, 'div', 'score__head');
  head.setAttribute('aria-hidden', 'true');
  const cards = [];
  let selectedIndex = 0;
  let editingIndex = 0;
  const dialog = el(doc, 'dialog', 'help score__rename-dialog');
  dialog.setAttribute('aria-labelledby', 'movement-rename-title');
  const form = el(doc, 'form');
  const heading = el(doc, 'h2', null, 'Renommer le mouvement');
  heading.id = 'movement-rename-title';
  const label = el(doc, 'label', 'field', 'Nom du mouvement ');
  const input = el(doc, 'input', 'btn');
  input.type = 'text'; input.maxLength = 40; input.required = true;
  input.name = 'movement-name'; input.autocomplete = 'off';
  label.append(input);
  const actions = el(doc, 'div', 'row row--end');
  const cancel = el(doc, 'button', 'btn btn--ghost', 'Annuler');
  cancel.type = 'button';
  const save = el(doc, 'button', 'btn btn--primary', 'Enregistrer le nom');
  save.type = 'submit'; actions.append(cancel, save);
  form.append(heading, label, actions); dialog.append(form);
  cancel.addEventListener('click', () => dialog.close());
  input.addEventListener('input', () => input.setCustomValidity(''));
  form.addEventListener('submit', ev => {
    ev.preventDefault();
    const next = input.value.trim();
    if (!next) { input.setCustomValidity('Donnez un nom au mouvement.'); input.reportValidity(); return; }
    cb.rename(editingIndex, next);
    dialog.close();
  });
  dialog.addEventListener('close', () => cards[editingIndex].btn.focus());
  function requestName(i) {
    editingIndex = i;
    input.value = cards[i].name.textContent;
    input.setCustomValidity('');
    if (!dialog.open) dialog.showModal();
    input.focus(); input.select();
  }
  for (let i = 0; i < 4; i++) {
    const li = el(doc, 'li', 'score__slot');
    const btn = el(doc, 'button', 'score__card');
    btn.type = 'button';
    btn.dataset.index = String(i);
    const num = el(doc, 'span', 'score__num', ['I', 'II', 'III', 'IV'][i]);
    const name = el(doc, 'span', 'score__name');
    const meta = el(doc, 'span', 'score__meta');
    const prev = el(doc, 'span', 'score__preview');
    btn.append(prev, num, name, meta);
    btn.addEventListener('click', () => cb.select(i));
    btn.addEventListener('dblclick', () => requestName(i));
    btn.addEventListener('keydown', ev => {
      if (ev.key === 'F2') { ev.preventDefault(); cb.select(i); requestName(i); }
    });
    li.append(btn);
    lane.append(li);
    cards.push({ btn, name, meta, prev, sig: '' });
  }
  lane.append(head);
  root.append(bar, lane, dialog);

  play.addEventListener('click', () => cb.togglePlay());
  loop.addEventListener('click', () => cb.toggleLoop());
  copy.addEventListener('click', () => cb.copyNext());
  rename.addEventListener('click', () => requestName(selectedIndex));
  demo.addEventListener('click', () => cb.demo?.());
  bars.addEventListener('change', () => cb.setBars(Number(bars.value)));

  let lastPos = '';

  return {
    /** Met à jour la structure (appelé à chaque modification de partition). */
    render({ score, selected, transport }) {
      selectedIndex = selected;
      bars.value = String(score.bars);
      play.textContent = transport.playing ? '❚❚ Pause' : '▶ Jouer';
      play.setAttribute('aria-pressed', String(transport.playing));
      loop.setAttribute('aria-pressed', String(transport.loop));
      copy.disabled = transport.playing;
      rename.disabled = transport.playing;
      root.classList.toggle('is-playing', transport.playing);
      score.movements.forEach((m, i) => {
        const c = cards[i];
        c.name.textContent = m.name;
        const beacons = m.nodes.filter((n) => n.type === 'beacon').length;
        c.meta.textContent = `${m.nodes.length} élém. · ${beacons} balise${beacons > 1 ? 's' : ''}`;
        const sig = JSON.stringify(m.nodes.map((n) => [n.type, n.x.toFixed(3), n.y.toFixed(3), n.strength.toFixed(1)]));
        if (sig !== c.sig) {
          c.sig = sig;
          c.prev.replaceChildren(atlasPreview({ nodes: m.nodes }, doc));
        }
        c.btn.setAttribute('aria-current', String(!transport.playing && i === selected));
        c.btn.setAttribute('aria-label', `Mouvement ${i + 1}, ${m.name} : ${c.meta.textContent}${!transport.playing && i === selected ? ' (en édition)' : ''}`);
      });
    },
    /** Met à jour la tête de lecture (appelé à chaque image, léger). */
    tick({ score, transport, phase }) {
      head.style.setProperty('--phase', String(phase));
      const { index } = playheadInfo(phase);
      cards.forEach((c, i) => c.btn.classList.toggle('is-live', transport.playing && i === index));
      const { bar: b, beat } = barBeat(transport.beat, score.bars);
      const text = `Mesure ${b} · ${beat}`;
      if (text !== lastPos) {
        pos.textContent = text;
        lastPos = text;
      }
    },
  };
}
