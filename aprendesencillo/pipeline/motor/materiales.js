// Materiales con textura procedural, geometrías habituales y pequeños ayudantes visuales.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export function azar(semilla = 1) {
  return () => { semilla |= 0; semilla = (semilla + 0x6d2b79f5) | 0; let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function lienzo(w, h, dibujar) { const c = document.createElement('canvas'); c.width = w; c.height = h; dibujar(c.getContext('2d'), w, h); return c; }
const CACHE = {};
function textura(nombre, dibujar, { color = true, w = 1024, h = 1024 } = {}) {
  if (!CACHE[nombre]) {
    const t = new THREE.CanvasTexture(lienzo(w, h, dibujar));
    if (color) t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    CACHE[nombre] = t;
  }
  return CACHE[nombre];
}

// --- texturas ---
const cepillado = () => textura('cepillado', (g, w, h) => {
  const r = azar(3); g.fillStyle = '#b4b4b4'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) { const v = 120 + r() * 135; g.strokeStyle = `rgba(${v},${v},${v},${0.18 + r() * 0.3})`; g.lineWidth = 0.6 + r() * 1.6; const y = r() * h; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + (r() - 0.5) * 6); g.stroke(); }
}, { color: false });

const madera = () => textura('madera', (g, w, h) => {
  const r = azar(11), tablas = 4, ancho = w / tablas;
  for (let k = 0; k < tablas; k++) {
    const base = [214 + r() * 18, 172 + r() * 18, 118 + r() * 16];
    g.fillStyle = `rgb(${base})`; g.fillRect(k * ancho, 0, ancho, h);
    for (let i = 0; i < 70; i++) {
      const x0 = k * ancho + r() * ancho, oscuro = 0.5 + r() * 0.35;
      g.strokeStyle = `rgba(${base[0] * oscuro | 0},${base[1] * oscuro * 0.92 | 0},${base[2] * oscuro * 0.8 | 0},${0.12 + r() * 0.3})`; g.lineWidth = 0.8 + r() * 3.5;
      g.beginPath(); g.moveTo(x0, 0);
      for (let y = 0; y <= h; y += 24) g.lineTo(x0 + Math.sin(y / (90 + k * 13) + i) * (4 + r() * 3), y);
      g.stroke();
    }
    g.fillStyle = 'rgba(70,40,15,.35)'; g.fillRect(k * ancho, 0, 3, h);
  }
});

const hormigon = () => textura('hormigon', (g, w, h) => {
  const r = azar(5); g.fillStyle = '#a2a5ab'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 26000; i++) { const v = 110 + r() * 110; g.fillStyle = `rgba(${v},${v},${v + 4},${0.15 + r() * 0.35})`; const s = 0.6 + r() * 2.4; g.fillRect(r() * w, r() * h, s, s); }
  for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(60,62,66,${0.25 + r() * 0.3})`; g.beginPath(); g.arc(r() * w, r() * h, 1 + r() * 3, 0, 6.3); g.fill(); }
});

const ruido = () => textura('ruido', (g, w, h) => {
  const r = azar(9), img = g.createImageData(w, h);
  for (let i = 0; i < img.data.length; i += 4) { const v = 150 + r() * 105; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  g.putImageData(img, 0, 0);
}, { color: false, w: 512, h: 512 });

const resplandor = () => textura('resplandor', (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
}, { w: 256, h: 256 });

const repetida = (t, rx, ry) => { const c = t.clone(); c.repeat.set(rx, ry); c.needsUpdate = true; return c; };

export const mat = {
  // Metal cepillado (anisótropo). Los brillos alargados son lo que lo hace creíble.
  metal: (color = 0xc3c8d0, rugosidad = 0.32) => new THREE.MeshStandardMaterial({ color, metalness: 1, roughness: rugosidad, roughnessMap: cepillado() }),
  metalPulido: (color = 0xd8dce3, rugosidad = 0.12) => new THREE.MeshStandardMaterial({ color, metalness: 1, roughness: rugosidad }),
  oro: () => new THREE.MeshStandardMaterial({ color: 0xe0ac46, metalness: 1, roughness: 0.22 }),
  laton: () => new THREE.MeshStandardMaterial({ color: 0xc9a25a, metalness: 1, roughness: 0.3, roughnessMap: cepillado() }),
  plastico: (color = 0x222222, rugosidad = 0.45) => new THREE.MeshStandardMaterial({ color, metalness: 0, roughness: rugosidad, roughnessMap: ruido() }),
  goma: (color = 0x16171b) => new THREE.MeshStandardMaterial({ color, roughness: 0.92, bumpMap: ruido(), bumpScale: 0.6 }),
  vidrio: (color = 0xbff4ff, opacidad = 0.16) => new THREE.MeshStandardMaterial({ color, metalness: 0, roughness: 0.04, transparent: true, opacity: opacidad, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 2 }),
  emisivo: (color = 0x2ee6f0, intensidad = 1.6) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensidad }),
  madera: (rx = 1, ry = 1) => new THREE.MeshStandardMaterial({ map: repetida(madera(), rx, ry), bumpMap: repetida(madera(), rx, ry), bumpScale: 0.8, roughness: 0.62 }),
  hormigon: (rx = 1, ry = 1) => new THREE.MeshStandardMaterial({ map: repetida(hormigon(), rx, ry), bumpMap: repetida(hormigon(), rx, ry), bumpScale: 1.2, roughness: 0.95 }),
  // Material con una textura pintada a mano (rótulos, escalas, pantallas): pintar(ctx2d, w, h).
  pintado: (pintar, { w = 1024, h = 1024, rugosidad = 0.5, metal = 0, emisivo = false } = {}) => {
    const t = new THREE.CanvasTexture(lienzo(w, h, pintar)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    return new THREE.MeshStandardMaterial({ map: t, roughness: rugosidad, metalness: metal, ...(emisivo ? { emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.9 } : {}) });
  },
};

export const geo = {
  caja: (w, h, d, radio = 0.04) => new RoundedBoxGeometry(w, h, d, 5, radio),
  // Extruye una forma 2D (THREE.Shape) con bisel, que es lo que hace brillar los cantos.
  extruir: (forma, grosor = 0.2, bisel = 0.02) => {
    const g = new THREE.ExtrudeGeometry(forma, { depth: grosor, bevelEnabled: bisel > 0, bevelSize: bisel, bevelThickness: bisel, bevelSegments: 3, curveSegments: 32 });
    g.translate(0, 0, -grosor / 2); return g;
  },
  // Engranaje recto. Dos ruedas con el mismo radio/dientes engranan a distancia rA + rB - (2,5·r/n).
  engranaje(dientes, radio, grosor = 0.3, { agujero = 0.22, aligerado = 0, sinDiente = -1, chavetero = true } = {}) {
    const forma = new THREE.Shape(), paso = (Math.PI * 2) / dientes, h = (2.5 * radio) / dientes, rb = radio - h;
    for (let k = 0; k < dientes; k++) {
      const a = k * paso, pts = k === sinDiente
        ? [[rb, a], [rb, a + paso]]
        : [[rb, a], [rb + h * 0.15, a + 0.12 * paso], [radio, a + 0.2 * paso], [radio, a + 0.4 * paso], [rb + h * 0.15, a + 0.48 * paso], [rb, a + 0.6 * paso], [rb, a + paso]];
      pts.forEach(([r, ang], i) => (k === 0 && i === 0 ? forma.moveTo : forma.lineTo).call(forma, r * Math.cos(ang), r * Math.sin(ang)));
    }
    const ra = radio * agujero, hueco = new THREE.Path();
    if (chavetero) { const ch = ra * 0.28; hueco.moveTo(ra, -ch); hueco.lineTo(ra * 1.25, -ch); hueco.lineTo(ra * 1.25, ch); hueco.lineTo(ra, ch); hueco.absarc(0, 0, ra, Math.asin(ch / ra), Math.PI * 2 - Math.asin(ch / ra), false); }
    else hueco.absarc(0, 0, ra, 0, Math.PI * 2, true);
    forma.holes.push(hueco);
    for (let i = 0; i < aligerado; i++) { const a = (i / aligerado) * Math.PI * 2, p = new THREE.Path(); p.absarc(Math.cos(a) * radio * 0.58, Math.sin(a) * radio * 0.58, radio * 0.13, 0, Math.PI * 2, true); forma.holes.push(p); }
    return geo.extruir(forma, grosor, Math.min(0.025, h * 0.18));
  },
  // El diente k de engranaje(dientes, radio), suelto (para romperlo o resaltarlo).
  diente(dientes, radio, grosor = 0.3, k = 0) {
    const paso = (Math.PI * 2) / dientes, h = (2.5 * radio) / dientes, rb = radio - h * 1.05, a = k * paso, forma = new THREE.Shape();
    [[rb, a], [rb + h * 0.15, a + 0.12 * paso], [radio, a + 0.2 * paso], [radio, a + 0.4 * paso], [rb + h * 0.15, a + 0.48 * paso], [rb, a + 0.6 * paso]]
      .forEach(([r, ang], i) => (i ? forma.lineTo : forma.moveTo).call(forma, r * Math.cos(ang), r * Math.sin(ang)));
    return geo.extruir(forma, grosor, 0.01);
  },
  // Eje con estrías (las ranuras longitudinales de los ejes de caja de cambios).
  ejeEstriado(radio = 0.16, largo = 3, estrias = 18) {
    const forma = new THREE.Shape(), n = estrias * 2;
    for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2, r = i % 2 ? radio * 0.9 : radio; (i ? forma.lineTo : forma.moveTo).call(forma, Math.cos(a) * r, Math.sin(a) * r); }
    return geo.extruir(forma, largo, 0.008);
  },
  // Sólido de revolución a partir de un perfil [[radio, altura], ...] (botellas, latas, pomos, bombillas).
  torno: (perfil, segmentos = 64) => new THREE.LatheGeometry(perfil.map(([r, y]) => new THREE.Vector2(r, y)), segmentos),
};

// Aristas iluminadas (cristales, piezas fantasma, "planos" de referencia).
export function bordes(malla, { color = '#2ee6f0', opacidad = 0.95, angulo = 25 } = {}) {
  const l = new THREE.LineSegments(new THREE.EdgesGeometry(malla.geometry, angulo), new THREE.LineBasicMaterial({ color, transparent: true, opacity: opacidad }));
  l.userData.sinSombra = true; malla.add(l); return l;
}

// Resplandor aditivo (chispa, luz, punto caliente). Anima su opacidad con tween(halo.material, {opacity}).
export function halo(obj, { color = '#ffd23f', tam = 1, opacidad = 1 } = {}) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: resplandor(), color, transparent: true, opacity: opacidad, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.scale.set(tam, tam, 1); s.userData.sinSombra = true; obj.add(s); return s;
}
