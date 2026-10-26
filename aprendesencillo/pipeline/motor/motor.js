// Motor de @aprendesencillo. Carga el timeline (voz + subtítulos), monta la escena del vídeo
// (escenas/<id>.js) y expone pintar(t) para que render.cjs saque cada fotograma.
// Regla de oro: todo es función de t. Nada de requestAnimationFrame ni relojes.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { crearPost } from './post.js';
import { mat, geo, bordes, halo, azar } from './materiales.js';

const W = 1080, H = 1920;
const $ = id => document.getElementById(id);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, p) => a + (b - a) * p;
const EASE = {
  lineal: p => p,
  entra: p => p * p * p,
  sale: p => 1 - Math.pow(1 - p, 3),
  inOut: p => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
  suave: p => p * p * (3 - 2 * p),
  rebote: p => { const c = 1.70158; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); },
};
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const norm = s => s.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');

let D, renderer, escena, camara, post, sol;
const tweens = [], grupos = [], cada = [], overlays = [], emisores = [], temblores = [], sonidos = [];
const camPos = new THREE.Vector3(0, 0, 8), camMira = new THREE.Vector3(), camFov = { v: 35 };
const brillo = { r: 255, g: 170, b: 60, a: 0.2 };
// Profundidad de campo: foco 0 = automático (enfoca el punto al que mira la cámara). fondo: desenfoque del fondo (0-1).
const dof = { apertura: 1.3, foco: 0, fondo: 0, exposicion: 1 };
const tmp = new THREE.Vector3();

// ---------- tiempo ----------
const finDeFrase = t => (D.frases.find(f => t >= f.inicio && t < f.fin) || D.frases[D.frases.length - 1]).fin;

// Muelles en forma cerrada (siguen siendo función pura de t). dur = lo que tarda en asentarse; el número es el
// amortiguamiento: <1 se pasa un pelo y vuelve, 1 llega sin pasarse.
const MUELLES = { rapido: 0.75, muelle: 0.85, pesado: 1, jugueton: 0.5 };
function muelle(s, w, z) {
  if (s <= 0) return 0;
  if (z >= 1) return 1 - Math.exp(-w * s) * (1 + w * s);
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * s) * (Math.cos(wd * s) + (z * w / wd) * Math.sin(wd * s));
}

function tween(obj, props, { t, dur = 0.8, ease = 'inOut' } = {}) {
  dur = Math.max(0.001, dur);
  const z = MUELLES[ease];
  for (const k in props) tweens.push({ obj, k, to: props[k], t0: t, dur, ease: EASE[ease] || EASE.inOut, muelle: z && { z, w: 4.6 / (z * dur) } });
}

function agruparTweens() {
  const mapa = new Map();
  for (const tw of tweens) {
    if (!mapa.has(tw.obj)) mapa.set(tw.obj, new Map());
    const m = mapa.get(tw.obj);
    if (!m.has(tw.k)) m.set(tw.k, []);
    m.get(tw.k).push(tw);
  }
  for (const [obj, m] of mapa) for (const [k, lista] of m) {
    lista.sort((a, b) => a.t0 - b.t0);
    let prev = obj[k];
    for (const tw of lista) { tw.from = prev; prev = tw.to; }
    grupos.push({ obj, k, inicial: obj[k], lista });
  }
}

function aplicarTweens(t) {
  for (const g of grupos) {
    let v = g.inicial;
    for (const tw of g.lista) {
      if (t < tw.t0) break;
      // Un muelle por cada cambio de objetivo, sumados: si el objetivo cambia a mitad, el movimiento sigue siendo continuo.
      if (tw.muelle) v += (tw.to - tw.from) * muelle(t - tw.t0, tw.muelle.w, tw.muelle.z);
      else v = lerp(tw.from, tw.to, tw.ease(clamp((t - tw.t0) / tw.dur)));
    }
    g.obj[g.k] = v;
  }
}

// Ángulo acumulado a partir de una velocidad que cambia con el tiempo (rad/s), integrado de forma determinista.
function acumulado(vel, paso = 1 / 240) {
  const n = Math.ceil((D.duracion + 1) / paso) + 1, tabla = new Float64Array(n);
  for (let i = 1; i < n; i++) tabla[i] = tabla[i - 1] + vel((i - 0.5) * paso) * paso;
  return t => { const x = clamp(t / paso, 0, n - 1), i = Math.floor(x); return lerp(tabla[i], tabla[Math.min(i + 1, n - 1)], x - i); };
}

// ---------- anotaciones (HTML encima del 3D) ----------
function proyectar(ancla, offset) {
  if (Array.isArray(ancla)) tmp.set(ancla[0], ancla[1], ancla[2]); else ancla.getWorldPosition(tmp);
  if (offset) tmp.add(offset);
  tmp.project(camara);
  return [((tmp.x + 1) / 2) * W, ((1 - tmp.y) / 2) * H];
}

function overlay(html, cls, o = {}) {
  const el = document.createElement('div'); el.className = `ov ${cls}`; el.innerHTML = html; $('capa').appendChild(el);
  if (o.color) el.style.setProperty('--c', o.color);
  const t = o.t ?? 0;
  const ov = { el, t, hasta: o.hasta ?? finDeFrase(t), ancla: o.ancla, offset: o.offset && new THREE.Vector3(...o.offset), x: o.x ?? W / 2, y: o.y ?? H / 2,
               origen: o.origen || '-50%, -50%', entrada: o.entrada || 'escala', actualizar: o.actualizar, fijo: o.fijo };
  overlays.push(ov);
  const efecto = { etiqueta: 'pop', caja: 'pop', circulo: 'pop', giro: 'pop', tarjeta: 'pop', numero: 'pop', texto: 'pop', flecha: 'pop', sello: 'golpe' }[cls];
  if (efecto) sonido(efecto, t);
  return ov;
}

// Diseño de sonido: cada evento se sintetiza y se mezcla con la voz en render.cjs.
function sonido(tipo, t, { vol = 1, dur } = {}) { if (t != null) sonidos.push({ tipo, t: Math.max(0, t), vol, ...(dur ? { dur } : {}) }); }

function pintarOverlays(T) {
  for (const o of overlays) {
    if (T < o.t || T > o.hasta + 0.3) { o.el.style.display = 'none'; continue; }
    o.el.style.display = '';
    const pa = clamp((T - o.t) / 0.3), op = Math.min(EASE.sale(pa), clamp((o.hasta - T) / 0.25));
    o.el.style.opacity = op;
    o.el.style.filter = pa < 1 ? `blur(${(1 - pa) * 7}px)` : '';
    if (o.fijo) { o.actualizar?.(T, pa); continue; }
    const [px, py] = o.ancla ? proyectar(o.ancla, o.offset) : [o.x, o.y];
    const s = o.entrada === 'escala' ? 0.85 + 0.15 * EASE.rebote(pa) : o.entrada === 'golpe' ? 1.6 - 0.6 * EASE.sale(clamp((T - o.t) / 0.18)) : 1;
    o.el.style.transform = `translate(${px}px, ${py}px) translate(${o.origen}) scale(${s})`;
    o.actualizar?.(T, pa, px, py);
  }
}

const PALETA = ['#2ee6f0', '#4f7dff', '#a46bff', '#ff5fa2', '#ff9b3d', '#ffd23f'];
const ui = {
  // Número grande en monoespaciada. texto puede ser función de t (para contadores). colores: dígitos en degradado.
  numero({ texto, unidad = '', tam = 190, colores = true, ...o }) {
    const ov = overlay('', 'numero', o); ov.el.style.fontSize = `${tam}px`;
    let ultimo = null;
    const pintar = T => {
      const s = typeof texto === 'function' ? texto(T) : String(texto);
      if (s === ultimo) return; ultimo = s;
      let k = 0;
      ov.el.innerHTML = [...s].map(c => (colores && /\d/.test(c) && s.indexOf(c) !== 0 ? `<span style="color:${PALETA[k++ % PALETA.length]}">${esc(c)}</span>` : esc(c))).join('') +
        (unidad ? `<span class="uni">${esc(unidad)}</span>` : '');
    };
    pintar(o.t ?? 0); const prev = ov.actualizar; ov.actualizar = (T, ...r) => { pintar(T); prev?.(T, ...r); };
    return ov;
  },
  tarjeta({ titulo, valor, acento, ...o }) {
    const ov = overlay(`<div class="tit">${esc(titulo)}</div><div class="val">${valor}</div>`, 'tarjeta', o);
    if (acento) ov.el.style.setProperty('--acento', acento);
    return ov;
  },
  etiqueta(texto, o = {}) { return overlay(esc(texto), 'etiqueta', o); },
  texto(html, o = {}) { return overlay(html, 'texto', o); },
  nota(texto, o = {}) { return overlay(esc(texto), 'nota', { x: 70, y: 1440, origen: '0, -50%', entrada: 'fundido', ...o }); },
  sello(texto, o = {}) { return overlay(esc(texto), 'sello', { entrada: 'golpe', ...o }); },
  caja({ w = 200, h = 200, rotulo, ...o }) {
    const ov = overlay(rotulo ? `<span class="rot">${esc(rotulo)}</span>` : '', 'caja', o);
    ov.el.style.width = `${w}px`; ov.el.style.height = `${h}px`; return ov;
  },
  circulo({ r = 120, ...o }) { const ov = overlay('', 'circulo', o); ov.el.style.width = ov.el.style.height = `${2 * r}px`; return ov; },
  // Flecha recta o curva entre dos puntos (cada extremo: [x,y] en pantalla o {ancla, offset}).
  flecha({ desde, hacia, curva = 0, color = '#ffffff', grosor = 7, ...o }) {
    const ns = 'http://www.w3.org/2000/svg';
    const ov = overlay(`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><path fill="none" stroke="${color}" stroke-width="${grosor}" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      'flecha', { ...o, fijo: true });
    const path = ov.el.querySelector('path'); void ns;
    const punto = p => (Array.isArray(p) ? p : proyectar(p.ancla, p.offset && new THREE.Vector3(...p.offset)));
    ov.actualizar = (T, pa) => {
      const [x1, y1] = punto(desde), [x2, y2] = punto(hacia), dx = x2 - x1, dy = y2 - y1;
      const cx = (x1 + x2) / 2 - dy * curva, cy = (y1 + y2) / 2 + dx * curva;
      const ang = Math.atan2(y2 - cy, x2 - cx), L = 30;
      const a1 = [x2 - L * Math.cos(ang - 0.5), y2 - L * Math.sin(ang - 0.5)], a2 = [x2 - L * Math.cos(ang + 0.5), y2 - L * Math.sin(ang + 0.5)];
      path.setAttribute('d', `M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2} M${a1} L${x2} ${y2} L${a2}`);
      path.setAttribute('pathLength', '1'); path.setAttribute('stroke-dasharray', '1 1'); path.setAttribute('stroke-dashoffset', 1 - EASE.sale(pa));
    };
    return ov;
  },
  // Flecha circular alrededor de algo para indicar sentido de giro.
  giro({ r = 150, sentido = 'horario', color = '#2ee6f0', ...o }) {
    const s = 2 * r + 60, c = s / 2, horario = sentido === 'horario';
    const a0 = -Math.PI * 0.75, a1 = a0 + Math.PI * 1.4 * (horario ? 1 : -1);
    const pt = a => [c + r * Math.cos(a), c + r * Math.sin(a)];
    const [x0, y0] = pt(a0), [x1, y1] = pt(a1), tang = a1 + (horario ? Math.PI / 2 : -Math.PI / 2), L = 26;
    const p1 = [x1 - L * Math.cos(tang - 0.55), y1 - L * Math.sin(tang - 0.55)], p2 = [x1 - L * Math.cos(tang + 0.55), y1 - L * Math.sin(tang + 0.55)];
    const ov = overlay(`<svg width="${s}" height="${s}"><path d="M${x0} ${y0} A${r} ${r} 0 1 ${horario ? 1 : 0} ${x1} ${y1} M${p1} L${x1} ${y1} L${p2}" fill="none" stroke="${color}"
      stroke-width="8" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1 1" style="filter:drop-shadow(0 0 10px ${color})"/></svg>`, 'giro', o);
    const path = ov.el.querySelector('path'), prev = ov.actualizar;
    ov.actualizar = (T, pa, ...r2) => { path.setAttribute('stroke-dashoffset', 1 - EASE.sale(pa)); prev?.(T, pa, ...r2); };
    return ov;
  },
  // Móvil con la hoja de compartir: el dedo pulsa "Enviar" a los 1,4 s.
  compartir({ previa = '', nombres = ['Lucía', 'Javi', 'Marta'], caras = ['👩🏻', '🧔🏻', '👩🏽‍🦱'], ...o }) {
    const ov = overlay(`<div class="movil"><div class="previa">${esc(previa)}</div><div class="hoja"><div class="asa"></div><div class="buscar">🔍 Buscar</div>
      <div class="gente">${nombres.map((n, i) => `<div class="persona${i === 1 ? ' sel' : ''}"><div class="cara emoji">${caras[i % caras.length]}</div>${esc(n)}</div>`).join('')}</div>
      <div class="enviar">Enviar</div></div></div><div class="dedo emoji">👆</div>`, '', { y: 1180, ...o });
    const dedo = ov.el.querySelector('.dedo'), elegida = ov.el.querySelector('.persona.sel'), boton = ov.el.querySelector('.enviar');
    sonido('pop', ov.t); sonido('clic', ov.t + 0.85); sonido('clic', ov.t + 1.45);
    ov.actualizar = T => {
      const k = T - ov.t;
      const ruta = k < 0.8 ? [[420, 900], [330, 560], EASE.inOut(clamp(k / 0.8))] : [[330, 560], [280, 690], EASE.inOut(clamp((k - 0.9) / 0.5))];
      const [[xa, ya], [xb, yb], p] = ruta, pulsa = (k > 0.8 && k < 0.95) || (k > 1.4 && k < 1.55) ? 0.9 : 1;
      dedo.style.transform = `translate(${lerp(xa, xb, p)}px, ${lerp(ya, yb, p)}px) scale(${pulsa})`;
      elegida.classList.toggle('elegida', k > 0.88);
      boton.classList.toggle('hecho', k > 1.5); boton.textContent = k > 1.5 ? '✓ Enviado' : 'Enviar';
    };
    return ov;
  },
};

// ---------- efectos ----------
const fx = {
  chispas({ ancla, offset, x, y, t, dur = 0.5, n = 40, color = [255, 190, 80], semilla = 5 }) {
    const r = azar(semilla), p = [];
    for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (r() - 0.5) * Math.PI * 1.6, v = 500 + r() * 900; p.push({ nace: t + dur * r(), vx: Math.cos(a) * v, vy: Math.sin(a) * v, vida: 0.35 + r() * 0.35 }); }
    emisores.push({ ancla, offset: offset && new THREE.Vector3(...offset), x, y, p, color });
    sonido('chispas', t, { dur: dur + 0.4, vol: Math.min(1, n / 120) });
  },
  temblor({ t, dur = 0.4, fuerza = 0.05 }) { temblores.push({ t, dur, fuerza }); if (fuerza >= 0.04) sonido('golpe', t, { vol: 0.8 }); },
};

function pintarFx(T) {
  const g = $('fx').getContext('2d'); g.clearRect(0, 0, W, H); g.lineCap = 'round'; pintarMotas(g, T);
  for (const e of emisores) {
    const [ox, oy] = e.ancla ? proyectar(e.ancla, e.offset) : [e.x, e.y];
    for (const q of e.p) {
      const k = T - q.nace; if (k < 0 || k > q.vida) continue;
      const x = ox + q.vx * k, y = oy + q.vy * k + 1400 * k * k, a = 1 - k / q.vida;
      g.strokeStyle = `rgba(${e.color[0]},${e.color[1]},${e.color[2]},${a})`; g.lineWidth = 3 + 6 * a; g.shadowColor = 'rgba(255,170,60,.9)'; g.shadowBlur = 12;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x - q.vx * 0.025, y - (q.vy + 2800 * k) * 0.025); g.stroke();
    }
  }
}

// ---------- fondo: un shader a pantalla completa (sin subir texturas cada fotograma, que en WebGL por software es carísimo) ----------
const N_BOKEH = 9;
const bokeh = (() => { const r = azar(21), c = [[46, 230, 240], [79, 125, 255], [164, 107, 255], [255, 155, 61], [255, 95, 162]];
  return Array.from({ length: N_BOKEH }, (_, i) => ({ x: r() * W, y: 300 + r() * 1300, r: 70 + r() * 150, c: c[i % c.length], a: 0.07 + r() * 0.08, f: r() * 6.3 })); })();
const fondoMat = new THREE.ShaderMaterial({
  uniforms: { brillo: { value: new THREE.Vector4(1, 0.67, 0.24, 0.2) }, bPos: { value: bokeh.map(() => new THREE.Vector4()) }, bCol: { value: bokeh.map(b => new THREE.Vector3(...b.c.map(v => v / 255))) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }',
  fragmentShader: `uniform vec4 brillo; uniform vec4 bPos[${N_BOKEH}]; uniform vec3 bCol[${N_BOKEH}]; varying vec2 vUv;
    // Se mezcla en sRGB, como un canvas normal, y se pasa a lineal al final (si no, el tono ACES lo satura todo).
    void main(){
      vec2 q = vec2(vUv.x * 1080.0, (1.0 - vUv.y) * 1920.0);
      vec3 base = vec3(0.027, 0.031, 0.047), col = base;
      float dg = length(q - vec2(540.0, 1020.0)) / 980.0;
      col = mix(col, brillo.rgb, 1.6 * brillo.a * (dg < 0.35 ? mix(1.0, 0.35, dg / 0.35) : 0.35 * (1.0 - clamp((dg - 0.35) / 0.65, 0.0, 1.0))));
      for (int i = 0; i < 9; i++) { float d = length(q - bPos[i].xy) / bPos[i].z; col = mix(col, bCol[i], bPos[i].w * (1.0 - smoothstep(0.55, 1.0, d))); }
      vec2 g = abs(mod(q - vec2(540.0, 960.0) + 45.0, 90.0) - 45.0);
      col = mix(col, vec3(1.0), 0.03 * (1.0 - smoothstep(0.4, 1.4, min(g.x, g.y))));
      col = mix(col, base, 0.92 * smoothstep(300.0, 1150.0, length(q - vec2(540.0, 960.0))));
      gl_FragColor = vec4(pow(col, vec3(2.2)), 1.0);
    }`,
  depthTest: false, depthWrite: false,
});
function pintarFondo(T) {
  fondoMat.uniforms.brillo.value.set(brillo.r / 255, brillo.g / 255, brillo.b / 255, brillo.a);
  bokeh.forEach((b, i) => fondoMat.uniforms.bPos.value[i].set(b.x + Math.sin(T * 0.15 + b.f) * 40, b.y + Math.cos(T * 0.12 + b.f) * 30, b.r, b.a));
}
// Motas de polvo: van en la capa de efectos, por encima, muy tenues.
const motas = (() => { const r = azar(7); return Array.from({ length: 70 }, () => ({ x: r() * W, y: r() * H, r: 0.6 + r() * 1.6, v: 3 + r() * 10, f: r() * 6.3 })); })();
function pintarMotas(g, T) {
  g.fillStyle = '#fff';
  for (const m of motas) { g.globalAlpha = 0.08 + 0.22 * (0.5 + 0.5 * Math.sin(T * 1.3 + m.f)); g.beginPath(); g.arc(m.x + Math.sin(T * 0.2 + m.f) * 12, ((m.y - m.v * T) % H + H) % H, m.r, 0, 6.283); g.fill(); }
  g.globalAlpha = 1;
}

// ---------- subtítulos ----------
let grupoActual = null;
function pintarSubs(T) {
  const caja = $('subs'), grupo = D.subs.find(s => T >= s.ini && T < s.fin) || null;
  if (grupo !== grupoActual) {
    grupoActual = grupo;
    caja.innerHTML = grupo ? grupo.palabras.map(p => `<span class="p${p.clave ? ' clave' : ''}"><i class="sel"><b></b><b></b><b></b><b></b></i>${esc(p.w)}</span>`).join(' ') : '';
  }
  if (!grupo) return;
  const p = EASE.sale(clamp((T - grupo.ini) / 0.16));
  caja.style.opacity = p; caja.style.filter = p < 1 ? `blur(${(1 - p) * 9}px)` : ''; caja.style.transform = `translateY(${(1 - p) * 14}px)`;
  let activa = -1;
  grupo.palabras.forEach((w, i) => { if (T >= w.t) activa = i; });
  caja.querySelectorAll('.p').forEach((s, i) => s.classList.toggle('activa', i === activa));
}

// ---------- API para render.cjs ----------
window.iniciar = async datos => {
  D = datos;
  const escala = D.escala ?? 0.75;  // el 3D se pinta al 75 % y se escala; textos y anotaciones van nítidos encima
  renderer = new THREE.WebGLRenderer({ canvas: $('webgl'), antialias: false, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(Math.round(W * escala), Math.round(H * escala), false);
  renderer.toneMapping = THREE.NoToneMapping; renderer.outputColorSpace = THREE.LinearSRGBColorSpace;   // el tono y el sRGB los pone post.js
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  escena = new THREE.Scene();
  const fondoMalla = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), fondoMat); fondoMalla.frustumCulled = false; fondoMalla.renderOrder = -1000; fondoMalla.userData.sinSombra = true; escena.add(fondoMalla);
  escena.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture; escena.environmentIntensity = 0.6;
  sol = new THREE.DirectionalLight(0xfff4e6, 2.4); sol.position.set(3, 6, 5); sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024); sol.shadow.radius = 4; sol.shadow.bias = -0.0004; sol.shadow.normalBias = 0.02;
  escena.add(sol, sol.target);
  const contra = new THREE.DirectionalLight(0x9fd8ff, 1.3); contra.position.set(-5, 3, -4); escena.add(contra);
  const sombras = ({ centro = [0, 0, 0], tam = 5 } = {}) => {
    sol.target.position.set(...centro); sol.position.set(centro[0] + 3, centro[1] + 6, centro[2] + 5);
    Object.assign(sol.shadow.camera, { left: -tam, right: tam, top: tam, bottom: -tam, near: 0.5, far: 30 }); sol.shadow.camera.updateProjectionMatrix();
  };
  sombras();
  camara = new THREE.PerspectiveCamera(camFov.v, W / H, 0.05, 200);
  post = crearPost({ renderer, escena, camara, W, H, escala });

  const ctx = {
    THREE, escena, renderer, dur: D.duracion, frases: D.frases,
    f: i => D.frases[i].inicio,
    fin: i => D.frases[i].fin,
    palabra: (i, texto) => { const p = D.frases[i].palabras.find(p => norm(p.w).startsWith(norm(texto))); return p ? p.t : D.frases[i].inicio; },
    tween, cada: fn => cada.push(fn), acumulado, azar, EASE, mat, geo, ui, fx, bordes, halo, dof, sol, sombras, sonido,
    color: (c, hex, o) => { const k = new THREE.Color(hex); tween(c, { r: k.r, g: k.g, b: k.b }, o); },
    suelo: ({ y = -1, opacidad = 0.4, tam = 40 } = {}) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(tam, tam), new THREE.ShadowMaterial({ opacity: opacidad }));
      m.rotation.x = -Math.PI / 2; m.position.y = y; m.receiveShadow = true; m.userData.sinSombra = true; escena.add(m); return m;
    },
    camara: {
      poner: ({ pos, mira = [0, 0, 0], fov = 35 }) => { camPos.set(...pos); camMira.set(...mira); camFov.v = fov; },
      ir: ({ pos, mira, fov }, o) => {
        if (pos) tween(camPos, { x: pos[0], y: pos[1], z: pos[2] }, o); if (mira) tween(camMira, { x: mira[0], y: mira[1], z: mira[2] }, o); if (fov) tween(camFov, { v: fov }, o);
        if ((o?.dur ?? 0.8) >= 0.6 && (o?.t ?? 0) > 0.2 && o?.ease !== 'lineal') sonido('whoosh', o.t, { dur: Math.min(o.dur ?? 0.8, 1.4) });
      },
    },
    fondo: {
      brillo: (hex, o = {}) => { const k = new THREE.Color(hex); tween(brillo, { r: k.r * 255, g: k.g * 255, b: k.b * 255, ...(o.a != null ? { a: o.a } : {}) }, o); },
      ponerBrillo: (hex, a = 0.2) => { const k = new THREE.Color(hex); Object.assign(brillo, { r: k.r * 255, g: k.g * 255, b: k.b * 255, a }); },
    },
  };
  // Las texturas de canvas usan las fuentes al crearse: hay que tenerlas cargadas antes de montar la escena.
  await Promise.all(['500', '700', '800'].map(p => document.fonts.load(`${p} 40px "JetBrains Mono"`)).concat([document.fonts.load('800 40px Inter')]));
  const modulo = await import(`../../escenas/${D.id}.js`);
  await modulo.default(ctx);
  escena.traverse(o => { if (o.isMesh && !o.userData.sinSombra && !o.material.transparent) { o.castShadow = true; o.receiveShadow = true; } });
  agruparTweens();
  await document.fonts.ready;
};

window.pintar = T => {
  aplicarTweens(T);
  for (const fn of cada) fn(T);
  let dx = 0, dy = 0;
  for (const s of temblores) { const k = T - s.t; if (k < 0 || k > s.dur) continue; const e = s.fuerza * (1 - k / s.dur); dx += Math.sin(k * 90) * e; dy += Math.cos(k * 77) * e; }
  camara.position.set(camPos.x + dx, camPos.y + dy, camPos.z);
  camara.fov = camFov.v; camara.updateProjectionMatrix(); camara.lookAt(camMira);
  escena.updateMatrixWorld(); camara.updateMatrixWorld();
  pintarFondo(T);
  post.render({ foco: dof.foco > 0 ? dof.foco : camPos.distanceTo(camMira), apertura: dof.apertura, fondo: dof.fondo, exposicion: dof.exposicion });
  pintarOverlays(T); pintarFx(T); pintarSubs(T);
};
// Para la previa: lo que más pesa en el render por software (cuenta lo visible en el instante pintado).
window.estadisticas = () => {
  let mallas = 0, sombras = 0, tri = 0, luces = 0, lucesSombra = 0;
  escena.traverse(o => {
    if (o.isLight && o.visible && !o.isAmbientLight && !o.isHemisphereLight) { luces++; if (o.castShadow) lucesSombra += o.isPointLight ? 6 : 1; }
    if (!o.isMesh || !o.visible || o.userData.sinSombra && o.renderOrder === -1000) return;
    const g = o.geometry, n = o.isInstancedMesh ? o.count : 1;
    mallas += n; if (o.castShadow) sombras += n;
    tri += n * (g.index ? g.index.count : g.attributes.position.count) / 3;
  });
  return { mallas, sombras, tri: Math.round(tri), luces, lucesSombra };
};
// Lista de efectos de sonido sin duplicados (dos del mismo tipo a menos de 0,15 s cuentan como uno).
window.sonidos = () => {
  const lista = [...sonidos].sort((a, b) => a.t - b.t), fuera = [];
  for (const s of lista) if (!fuera.some(o => o.tipo === s.tipo && Math.abs(o.t - s.t) < 0.15)) fuera.push(s);
  return fuera.filter(s => s.t < D.duracion);
};
window.motorListo = true;
