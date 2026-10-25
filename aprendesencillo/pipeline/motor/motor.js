// Motor de @aprendesencillo. Carga el timeline (voz + subtítulos), monta la escena del vídeo
// (escenas/<id>.js) y expone pintar(t) para que render.cjs saque cada fotograma.
// Regla de oro: todo es función de t. Nada de requestAnimationFrame ni relojes.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const W = 1080, H = 1920;
const $ = id => document.getElementById(id);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, p) => a + (b - a) * p;
const EASE = {
  lineal: p => p,
  entra: p => p * p * p,
  sale: p => 1 - Math.pow(1 - p, 3),
  inOut: p => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
  rebote: p => { const c = 1.70158; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); },
};
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const norm = s => s.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');
function azar(semilla = 1) {
  return () => { semilla |= 0; semilla = (semilla + 0x6d2b79f5) | 0; let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

let D, renderer, escena, camara;
const tweens = [], grupos = [], cada = [], overlays = [], emisores = [], temblores = [];
const camPos = new THREE.Vector3(0, 0, 8), camMira = new THREE.Vector3(), camFov = { v: 35 };
const brillo = { r: 255, g: 170, b: 60, a: 0.2 };
const tmp = new THREE.Vector3();

// ---------- tiempo ----------
const finDeFrase = t => (D.frases.find(f => t >= f.inicio && t < f.fin) || D.frases[D.frases.length - 1]).fin;

function tween(obj, props, { t, dur = 0.8, ease = 'inOut' } = {}) {
  for (const k in props) tweens.push({ obj, k, to: props[k], t0: t, dur: Math.max(0.001, dur), ease: EASE[ease] || EASE.inOut });
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
    for (const tw of g.lista) { if (t < tw.t0) break; v = lerp(tw.from, tw.to, tw.ease(clamp((t - tw.t0) / tw.dur))); }
    g.obj[g.k] = v;
  }
}

// Ángulo acumulado a partir de una velocidad que cambia con el tiempo (rad/s), integrado de forma determinista.
function acumulado(vel, paso = 1 / 240) {
  const n = Math.ceil((D.duracion + 1) / paso) + 1, tabla = new Float64Array(n);
  for (let i = 1; i < n; i++) tabla[i] = tabla[i - 1] + vel((i - 0.5) * paso) * paso;
  return t => { const x = clamp(t / paso, 0, n - 1), i = Math.floor(x); return lerp(tabla[i], tabla[Math.min(i + 1, n - 1)], x - i); };
}

// ---------- 3D ----------
function texturaMadera() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512;
  const g = c.getContext('2d'), r = azar(11);
  g.fillStyle = '#d9b07a'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 90; i++) {
    g.strokeStyle = `rgba(${120 + r() * 40},${70 + r() * 30},${30 + r() * 20},${0.15 + r() * 0.25})`; g.lineWidth = 1 + r() * 4;
    g.beginPath(); const y = r() * 512; g.moveTo(0, y);
    for (let x = 0; x <= 512; x += 32) g.lineTo(x, y + Math.sin(x / 70 + i) * 6 + (r() - 0.5) * 4);
    g.stroke();
  }
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.wrapS = tx.wrapT = THREE.RepeatWrapping; return tx;
}

const mat = {
  metal: (color = 0xb9bec7, rugosidad = 0.3) => new THREE.MeshStandardMaterial({ color, metalness: 1, roughness: rugosidad }),
  oro: () => new THREE.MeshStandardMaterial({ color: 0xd9a441, metalness: 1, roughness: 0.25 }),
  plastico: (color = 0x222222, rugosidad = 0.5) => new THREE.MeshStandardMaterial({ color, metalness: 0, roughness: rugosidad }),
  vidrio: (color = 0x9fe8ff, opacidad = 0.22) => new THREE.MeshStandardMaterial({ color, metalness: 0.1, roughness: 0.05, transparent: true, opacity: opacidad, depthWrite: false, side: THREE.DoubleSide }),
  emisivo: (color = 0x2ee6f0, intensidad = 1.4) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensidad }),
  madera: () => new THREE.MeshStandardMaterial({ map: texturaMadera(), roughness: 0.7 }),
  hormigon: () => new THREE.MeshStandardMaterial({ color: 0x9a9da3, roughness: 0.95 }),
};

const geo = {
  caja: (w, h, d, radio = 0.04) => new RoundedBoxGeometry(w, h, d, 4, radio),
  // Engranaje recto. Con el mismo radio/dientes en dos ruedas, engranan a distancia rA + rB - (2,5·r/n).
  engranaje(dientes, radio, grosor = 0.3, { agujero = 0.22, aligerado = 0, sinDiente = -1 } = {}) {
    const forma = new THREE.Shape(), paso = (Math.PI * 2) / dientes, h = (2.5 * radio) / dientes, rb = radio - h;
    for (let k = 0; k < dientes; k++) {
      const a = k * paso, pts = k === sinDiente
        ? [[rb, a], [rb, a + paso]]
        : [[rb, a], [radio, a + 0.18 * paso], [radio, a + 0.42 * paso], [rb, a + 0.6 * paso], [rb, a + paso]];
      pts.forEach(([r, ang], i) => (k === 0 && i === 0 ? forma.moveTo : forma.lineTo).call(forma, r * Math.cos(ang), r * Math.sin(ang)));
    }
    const hueco = (x, y, r) => { const p = new THREE.Path(); p.absarc(x, y, r, 0, Math.PI * 2, true); forma.holes.push(p); };
    hueco(0, 0, radio * agujero);
    for (let i = 0; i < aligerado; i++) { const a = (i / aligerado) * Math.PI * 2; hueco(Math.cos(a) * radio * 0.58, Math.sin(a) * radio * 0.58, radio * 0.13); }
    const g = new THREE.ExtrudeGeometry(forma, { depth: grosor, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2, curveSegments: 24 });
    g.translate(0, 0, -grosor / 2); return g;
  },
  // Un diente suelto, colocado donde iría el diente k de engranaje(dientes, radio).
  diente(dientes, radio, grosor = 0.3, k = 0) {
    const paso = (Math.PI * 2) / dientes, h = (2.5 * radio) / dientes, rb = radio - h * 1.05, a = k * paso, forma = new THREE.Shape();
    [[rb, a], [radio, a + 0.18 * paso], [radio, a + 0.42 * paso], [rb, a + 0.6 * paso]]
      .forEach(([r, ang], i) => (i ? forma.lineTo : forma.moveTo).call(forma, r * Math.cos(ang), r * Math.sin(ang)));
    const g = new THREE.ExtrudeGeometry(forma, { depth: grosor, bevelEnabled: false }); g.translate(0, 0, -grosor / 2); return g;
  },
  textura(dibujar, w = 512, h = 512) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; dibujar(c.getContext('2d'), w, h);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; return tx;
  },
};

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
  overlays.push(ov); return ov;
}

function pintarOverlays(T) {
  for (const o of overlays) {
    if (T < o.t || T > o.hasta + 0.3) { o.el.style.display = 'none'; continue; }
    o.el.style.display = '';
    const pa = clamp((T - o.t) / 0.3), op = Math.min(EASE.sale(pa), clamp((o.hasta - T) / 0.25));
    o.el.style.opacity = op;
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
  },
  temblor({ t, dur = 0.4, fuerza = 0.05 }) { temblores.push({ t, dur, fuerza }); },
};

function pintarFx(T) {
  const g = $('fx').getContext('2d'); g.clearRect(0, 0, W, H); g.lineCap = 'round';
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

// ---------- fondo ----------
const motas = (() => { const r = azar(7); return Array.from({ length: 90 }, () => ({ x: r() * W, y: r() * H, r: 0.6 + r() * 2, v: 3 + r() * 10, f: r() * 6.3 })); })();
function pintarFondo(T) {
  document.body.style.setProperty('--brillo', `${brillo.r | 0}, ${brillo.g | 0}, ${brillo.b | 0}`);
  document.body.style.setProperty('--brillo-a', brillo.a.toFixed(3));
  const g = $('polvo').getContext('2d'); g.clearRect(0, 0, W, H);
  for (const m of motas) {
    g.globalAlpha = 0.15 + 0.35 * (0.5 + 0.5 * Math.sin(T * 1.3 + m.f)); g.fillStyle = '#fff';
    g.beginPath(); g.arc(m.x + Math.sin(T * 0.2 + m.f) * 12, ((m.y - m.v * T) % H + H) % H, m.r, 0, 6.283); g.fill();
  }
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
  let activa = -1;
  grupo.palabras.forEach((p, i) => { if (T >= p.t) activa = i; });
  caja.querySelectorAll('.p').forEach((s, i) => s.classList.toggle('activa', i === activa));
}

// ---------- API para render.cjs ----------
window.iniciar = async datos => {
  D = datos;
  renderer = new THREE.WebGLRenderer({ canvas: $('webgl'), antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(D.escalaWebgl ?? 0.75); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
  escena = new THREE.Scene();
  escena.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  const sol = new THREE.DirectionalLight(0xffffff, 1.6); sol.position.set(3, 5, 4); escena.add(sol);
  const contra = new THREE.DirectionalLight(0x9fd8ff, 1.0); contra.position.set(-4, 2, -3); escena.add(contra);
  camara = new THREE.PerspectiveCamera(camFov.v, W / H, 0.05, 200);

  const ctx = {
    THREE, escena, renderer, dur: D.duracion, frases: D.frases,
    f: i => D.frases[i].inicio,
    fin: i => D.frases[i].fin,
    palabra: (i, texto) => { const p = D.frases[i].palabras.find(p => norm(p.w).startsWith(norm(texto))); return p ? p.t : D.frases[i].inicio; },
    tween, cada: fn => cada.push(fn), acumulado, azar, EASE, mat, geo, ui, fx,
    color: (c, hex, o) => { const k = new THREE.Color(hex); tween(c, { r: k.r, g: k.g, b: k.b }, o); },
    camara: {
      poner: ({ pos, mira = [0, 0, 0], fov = 35 }) => { camPos.set(...pos); camMira.set(...mira); camFov.v = fov; },
      ir: ({ pos, mira, fov }, o) => { if (pos) tween(camPos, { x: pos[0], y: pos[1], z: pos[2] }, o); if (mira) tween(camMira, { x: mira[0], y: mira[1], z: mira[2] }, o); if (fov) tween(camFov, { v: fov }, o); },
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
  renderer.render(escena, camara);
  pintarFondo(T); pintarOverlays(T); pintarFx(T); pintarSubs(T);
};
window.motorListo = true;
