// PELAGIC V2 — rendu du plancton. Auteur : CLAUDE.
// WebGL2 : traînées persistantes en ping-pong, segments additifs colorés par la
// vitesse, halos pour le plancton lumineux, bloom léger. Repli Canvas 2D
// automatique (absence de WebGL2 ou perte de contexte).
//
// Entrée commune (« vue ») : { n, x, y, px, py, speed?, light? } — tableaux
// indexables (Float32Array de préférence), coordonnées monde [0,1].

export const PALETTE = Object.freeze([
  [0.106, 0.365, 0.612], // #1b5d9c abysses
  [0.165, 0.561, 0.816], // #2a8fd0
  [0.247, 0.769, 0.902], // #3fc4e6
  [0.373, 1.0, 0.816], //   #5fffd0 menthe
  [0.722, 1.0, 0.914], //   #b8ffe9
  [1.0, 1.0, 1.0], //       écume
]);
const PALETTE_CSS = ['#1b5d9c', '#2a8fd0', '#3fc4e6', '#5fffd0', '#b8ffe9', '#ffffff'];

/** Position [0,1] dans la palette selon la vitesse (échelle logarithmique). */
export function speedToT(speed, ref = 0.008, span = 30) {
  if (!(speed > 0)) return 0;
  return Math.min(1, Math.max(0, Math.log(speed / ref) / Math.log(span)));
}

/** Vitesse d'une particule : champ du moteur si présent, sinon déplacement. */
function speedOf(view, i, dtHint) {
  if (view.speed) return view.speed[i];
  const dx = view.x[i] - view.px[i];
  const dy = view.y[i] - view.py[i];
  return Math.hypot(dx, dy) / dtHint;
}

/**
 * Remplit un tampon de segments (2 sommets par particule, 5 flottants par
 * sommet : x, y, t, light, alpha) en pixels. Fonction pure, testée.
 * @returns {number} nombre de sommets écrits
 */
export function fillSegments(view, rect, out, stretch = 0.8, dtHint = 1 / 60) {
  const n = Math.min(view.n, Math.floor(out.length / 10));
  const { x: ox, y: oy, size } = rect;
  let o = 0;
  for (let i = 0; i < n; i++) {
    const ax = ox + view.px[i] * size;
    const ay = oy + view.py[i] * size;
    const bx = ox + view.x[i] * size;
    const by = oy + view.y[i] * size;
    const moved = ax !== bx || ay !== by;
    const ex = bx + (bx - ax) * stretch;
    const ey = by + (by - ay) * stretch;
    const t = speedToT(speedOf(view, i, dtHint));
    const light = view.light ? view.light[i] : 0;
    const alpha = moved ? 1 : 0;
    out[o++] = ax; out[o++] = ay; out[o++] = t; out[o++] = light; out[o++] = alpha;
    out[o++] = ex === ax && ey === ay ? ex + 0.5 : ex; out[o++] = ey; out[o++] = t; out[o++] = light; out[o++] = alpha;
  }
  return n * 2;
}

/** Adaptateur : particules V1 (objets) → vue SoA réutilisable. */
export function createObjectView() {
  let cap = 0;
  const view = { n: 0, x: null, y: null, px: null, py: null, speed: null, light: null };
  return function fromObjects(particles) {
    if (particles.length > cap) {
      cap = Math.ceil(particles.length * 1.25);
      for (const k of ['x', 'y', 'px', 'py', 'speed', 'light']) view[k] = new Float32Array(cap);
    }
    view.n = particles.length;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      view.x[i] = p.x; view.y[i] = p.y; view.px[i] = p.px; view.py[i] = p.py;
      view.speed[i] = p.speed ?? 0;
      view.light[i] = p.light ?? 0;
    }
    return view;
  };
}

// ---------------------------------------------------------------- WebGL2

const VS_QUAD = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() { v_uv = a_pos * 0.5 + 0.5; gl_Position = vec4(a_pos, 0.0, 1.0); }`;

const FS_FADE = `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_keep;
out vec4 o;
void main() {
  vec4 c = texture(u_tex, v_uv);
  o = max(c * u_keep - vec4(0.4 / 255.0), vec4(0.0));
}`;

const VS_SEG = `#version 300 es
in vec2 a_pos;
in vec3 a_attr; // t, light, alpha
uniform vec2 u_res;
uniform float u_point;
out vec3 v_attr;
void main() {
  v_attr = a_attr;
  vec2 clip = a_pos / u_res * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  gl_PointSize = u_point * (1.0 + a_attr.y * 3.0);
}`;

const PALETTE_GLSL = `
vec3 palette(float t) {
  vec3 c0 = vec3(0.106, 0.365, 0.612), c1 = vec3(0.165, 0.561, 0.816), c2 = vec3(0.247, 0.769, 0.902);
  vec3 c3 = vec3(0.373, 1.0, 0.816), c4 = vec3(0.722, 1.0, 0.914), c5 = vec3(1.0);
  float s = t * 5.0;
  if (s < 1.0) return mix(c0, c1, s);
  if (s < 2.0) return mix(c1, c2, s - 1.0);
  if (s < 3.0) return mix(c2, c3, s - 2.0);
  if (s < 4.0) return mix(c3, c4, s - 3.0);
  return mix(c4, c5, s - 4.0);
}`;

const FS_SEG = `#version 300 es
precision mediump float;
in vec3 v_attr;
uniform float u_gain;
out vec4 o;
${PALETTE_GLSL}
void main() {
  float light = v_attr.y;
  vec3 base = palette(v_attr.x) * (0.55 + v_attr.x * 0.45);
  vec3 lum = vec3(0.45, 1.0, 0.9) * light * 0.9; // lueur des dinoflagellés
  o = vec4((base + lum) * v_attr.z * u_gain, v_attr.z);
}`;

const FS_GLOW = `#version 300 es
precision mediump float;
in vec3 v_attr;
out vec4 o;
void main() {
  vec2 d = gl_PointCoord * 2.0 - 1.0;
  float r = dot(d, d);
  if (r > 1.0 || v_attr.y < 0.04) discard;
  float a = exp(-r * 3.5) * v_attr.y * v_attr.z;
  o = vec4(vec3(0.45, 1.0, 0.88) * a * 0.45, a * 0.5);
}`;

const FS_BLUR = `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_dir;
out vec4 o;
void main() {
  vec4 c = texture(u_tex, v_uv) * 0.227;
  c += (texture(u_tex, v_uv + u_dir * 1.385) + texture(u_tex, v_uv - u_dir * 1.385)) * 0.316;
  c += (texture(u_tex, v_uv + u_dir * 3.231) + texture(u_tex, v_uv - u_dir * 3.231)) * 0.070;
  o = c;
}`;

const FS_COMPOSE = `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_trail;
uniform sampler2D u_bloom;
uniform float u_bloom_gain;
out vec4 o;
void main() {
  vec3 c = texture(u_trail, v_uv).rgb + texture(u_bloom, v_uv).rgb * u_bloom_gain;
  c = c / (1.0 + c * 0.12); // tonemapping doux : pas de blanc brûlé
  o = vec4(c, max(c.r, max(c.g, c.b)));
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error(`Shader : ${log}`);
  }
  return s;
}

function program(gl, vs, fs, attribs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  attribs.forEach((name, i) => gl.bindAttribLocation(p, i, name));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`Programme : ${gl.getProgramInfoLog(p)}`);
  const uniforms = {};
  const count = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < count; i++) {
    const { name } = gl.getActiveUniform(p, i);
    uniforms[name] = gl.getUniformLocation(p, name);
  }
  return { p, u: uniforms };
}

function target(gl, w, h, half) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  if (half) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
  else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  return { tex, fb, w, h, ok };
}

function createGLRenderer(doc) {
  const canvas = doc.createElement('canvas');
  const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, alpha: true, antialias: false, preserveDrawingBuffer: false });
  if (!gl) return null;
  const half = Boolean(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'));

  const fade = program(gl, VS_QUAD, FS_FADE, ['a_pos']);
  const seg = program(gl, VS_SEG, FS_SEG, ['a_pos', 'a_attr']);
  const glow = program(gl, VS_SEG, FS_GLOW, ['a_pos', 'a_attr']);
  const blur = program(gl, VS_QUAD, FS_BLUR, ['a_pos']);
  const compose = program(gl, VS_QUAD, FS_COMPOSE, ['a_pos']);

  const quad = gl.createVertexArray();
  gl.bindVertexArray(quad);
  const qb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, qb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 20, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 20, 8);
  gl.bindVertexArray(null);

  let verts = new Float32Array(0);
  let trails = [];
  let blurA = null;
  let blurB = null;
  let lost = false;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; });

  function drawQuad() {
    gl.bindVertexArray(quad);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function resize(w, h) {
    canvas.width = w;
    canvas.height = h;
    for (const t of [...trails, blurA, blurB]) {
      if (!t) continue;
      gl.deleteTexture(t.tex);
      gl.deleteFramebuffer(t.fb);
    }
    trails = [target(gl, w, h, half), target(gl, w, h, half)];
    const bw = Math.max(1, Math.round(w / 4));
    const bh = Math.max(1, Math.round(h / 4));
    blurA = target(gl, bw, bh, half);
    blurB = target(gl, bw, bh, half);
    if (!trails[0].ok || !blurA.ok) throw new Error('Framebuffer WebGL2 incomplet.');
  }

  return {
    kind: 'webgl2',
    canvas,
    get lost() { return lost || gl.isContextLost(); },
    resize,
    clear() {
      for (const t of trails) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
    },
    draw(view, { rect, persistence = 0.95, dpr = 1, paused = false, bloom = 0.9 }) {
      if (this.lost || !trails.length) return;
      const [src, dst] = trails;
      const { width: W, height: H } = canvas;

      // 1. Fondu de la traînée précédente (en pause : figée, pas de fondu).
      gl.disable(gl.BLEND);
      gl.disable(gl.SCISSOR_TEST);
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
      gl.viewport(0, 0, W, H);
      gl.useProgram(fade.p);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, src.tex);
      gl.uniform1i(fade.u.u_tex, 0);
      gl.uniform1f(fade.u.u_keep, paused ? 1 : persistence);
      drawQuad();

      // 2. Segments + halos, additifs, découpés au carré du monde.
      if (!paused && view.n > 0) {
        if (verts.length < view.n * 10) verts = new Float32Array(Math.ceil(view.n * 1.25) * 10);
        const count = fillSegments(view, rect, verts);
        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, verts.subarray(0, count * 5), gl.STREAM_DRAW);
        gl.enable(gl.SCISSOR_TEST);
        gl.scissor(Math.floor(rect.x), Math.floor(H - rect.y - rect.size), Math.ceil(rect.size), Math.ceil(rect.size));
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.useProgram(seg.p);
        gl.uniform2f(seg.u.u_res, W, H);
        gl.uniform1f(seg.u.u_point, 1);
        gl.uniform1f(seg.u.u_gain, 1.1);
        gl.drawArrays(gl.LINES, 0, count);
        gl.useProgram(glow.p);
        gl.uniform2f(glow.u.u_res, W, H);
        gl.uniform1f(glow.u.u_point, 2.2 * dpr);
        gl.drawArrays(gl.POINTS, 0, count);
        gl.disable(gl.SCISSOR_TEST);
      }
      trails = [dst, src];

      // 3. Bloom : réduction ¼ + flou séparable.
      gl.disable(gl.BLEND);
      gl.useProgram(blur.p);
      gl.uniform1i(blur.u.u_tex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, blurA.fb);
      gl.viewport(0, 0, blurA.w, blurA.h);
      gl.bindTexture(gl.TEXTURE_2D, dst.tex);
      gl.uniform2f(blur.u.u_dir, 1 / blurA.w, 0);
      drawQuad();
      gl.bindFramebuffer(gl.FRAMEBUFFER, blurB.fb);
      gl.bindTexture(gl.TEXTURE_2D, blurA.tex);
      gl.uniform2f(blur.u.u_dir, 0, 1 / blurA.h);
      drawQuad();

      // 4. Composition à l'écran (alpha prémultiplié).
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, W, H);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(compose.p);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, dst.tex);
      gl.uniform1i(compose.u.u_trail, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, blurB.tex);
      gl.uniform1i(compose.u.u_bloom, 1);
      gl.uniform1f(compose.u.u_bloom_gain, bloom);
      drawQuad();
      gl.activeTexture(gl.TEXTURE0);
    },
  };
}

// ---------------------------------------------------------------- Canvas 2D

function create2DRenderer(doc) {
  const canvas = doc.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const buckets = PALETTE_CSS.map(() => []);
  return {
    kind: '2d',
    canvas,
    lost: false,
    resize(w, h) { canvas.width = w; canvas.height = h; },
    clear() { ctx.clearRect(0, 0, canvas.width, canvas.height); },
    draw(view, { rect, persistence = 0.95, dpr = 1, paused = false }) {
      if (paused) return;
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = `rgba(0,0,0,${(1 - persistence).toFixed(3)})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineWidth = 1.15 * dpr;
      ctx.lineCap = 'round';
      for (const b of buckets) b.length = 0;
      for (let i = 0; i < view.n; i++) {
        if (view.px[i] === view.x[i] && view.py[i] === view.y[i]) continue;
        const t = speedToT(speedOf(view, i, 1 / 60));
        buckets[Math.min(5, Math.floor(t * 5.999))].push(i);
      }
      const { x: ox, y: oy, size } = rect;
      ctx.save();
      ctx.beginPath();
      ctx.rect(ox, oy, size, size);
      ctx.clip();
      buckets.forEach((list, k) => {
        if (!list.length) return;
        ctx.strokeStyle = PALETTE_CSS[k];
        ctx.globalAlpha = 0.55 + k * 0.07;
        ctx.beginPath();
        for (const i of list) {
          const ax = ox + view.px[i] * size;
          const ay = oy + view.py[i] * size;
          const bx = ox + view.x[i] * size;
          const by = oy + view.y[i] * size;
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx + (bx - ax) * 0.8, by + (by - ay) * 0.8);
        }
        ctx.stroke();
      });
      // Plancton lumineux : petits halos.
      if (view.light) {
        ctx.fillStyle = '#8dffe0';
        for (let i = 0; i < view.n; i++) {
          const l = view.light[i];
          if (l < 0.15) continue;
          ctx.globalAlpha = Math.min(1, l);
          const r = (1 + l * 2.5) * dpr;
          ctx.fillRect(ox + view.x[i] * size - r / 2, oy + view.y[i] * size - r / 2, r, r);
        }
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    },
  };
}

/**
 * Crée le meilleur renderer disponible.
 * @param {{prefer?: 'webgl2'|'2d', doc?: Document}} options
 */
export function createRenderer({ prefer = 'webgl2', doc = globalThis.document } = {}) {
  if (prefer === 'webgl2') {
    try {
      const r = createGLRenderer(doc);
      if (r) return r;
    } catch (err) {
      console.warn('WebGL2 indisponible, repli Canvas 2D :', err.message);
    }
  }
  return create2DRenderer(doc);
}
