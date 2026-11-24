// Sonification V2 (sans Web Audio) — auteur : CLAUDE.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SCALES, VOICES, canonicalScale, canonicalVoice, createAudio, noteName, pickRecordingType, pitchForDepth, scaleSteps } from '../src/audio.js';

test('les balises hautes sonnent plus aigu que les profondes, dans chaque gamme', () => {
  for (const scale of Object.keys(SCALES)) {
    assert.ok(pitchForDepth(0, scale) > pitchForDepth(0.5, scale), scale);
    assert.ok(pitchForDepth(0.5, scale) > pitchForDepth(1, scale), scale);
    assert.equal(pitchForDepth(1, scale), 110);
    assert.equal(pitchForDepth(0, scale), 880); // trois octaves
  }
});

test('les gammes restent dans leurs degrés et une gamme inconnue retombe sur la pentatonic', () => {
  for (const [name, steps] of Object.entries(SCALES)) {
    for (const s of scaleSteps(name)) assert.ok(steps.includes(s % 12) || s === 36, `${name}:${s}`);
  }
  assert.deepEqual(scaleSteps('inconnue'), scaleSteps('pentatonic'));
  assert.notDeepEqual(scaleSteps('lydian'), scaleSteps('insen'));
});

test('pitchForDepth tolère les valeurs hors bornes', () => {
  assert.equal(pitchForDepth(5), pitchForDepth(1));
  assert.equal(pitchForDepth(-5), pitchForDepth(0));
  assert.ok(Number.isFinite(pitchForDepth(NaN)));
});

test('noteName nomme la base et l’octave', () => {
  assert.equal(noteName(110), 'La2');
  assert.equal(noteName(220), 'La3');
  assert.equal(noteName(110 * 2 ** (3 / 12)), 'Do3');
});

test('pickRecordingType choisit le premier format pris en charge', () => {
  assert.equal(pickRecordingType((t) => t === 'audio/webm'), 'audio/webm');
  assert.equal(pickRecordingType(() => false), null);
  assert.equal(pickRecordingType(() => { throw new Error('x'); }), null);
});

test('sans Web Audio, le moteur sonore se dégrade sans erreur', async () => {
  const audio = createAudio();
  assert.equal(audio.supported, false);
  assert.equal(audio.canRecord, false);
  assert.equal(await audio.enable(), false);
  assert.equal(audio.note(440, { voice: 'bell' }), false);
  assert.equal(audio.chime(440, 1, 0), false);
  assert.equal(audio.shimmer(1), false);
  assert.equal(audio.startRecording(), false);
  assert.equal(await audio.stopRecording(), null);
  audio.setVolume(2);
  audio.disable();
  assert.deepEqual(VOICES, ['glass', 'bell', 'pluck', 'breath']);
});

test('les alias français sont acceptés comme le moteur', () => {
  assert.equal(canonicalScale('dorien'), 'dorian');
  assert.equal(canonicalScale('insen'), 'insen');
  assert.equal(canonicalScale('??'), 'pentatonic');
  assert.equal(canonicalVoice('abysse'), 'bell');
  assert.equal(canonicalVoice('pluck'), 'pluck');
  assert.equal(canonicalVoice(undefined), 'glass');
  assert.deepEqual(scaleSteps('lydien'), scaleSteps('lydian'));
});

test('les clés héritées d’Object ne passent pas pour des gammes ou des voix (audit CODEX)', () => {
  for (const k of ['toString', 'constructor', '__proto__', 'hasOwnProperty']) {
    assert.equal(canonicalScale(k), 'pentatonic', k);
    assert.equal(canonicalVoice(k), 'glass', k);
    assert.ok(Number.isFinite(pitchForDepth(0.5, k)), k);
  }
});
