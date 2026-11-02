// Estilo ilustrado: mundos con cielo, niebla y suelo; personas y multitudes estilizadas (sin cara, colores planos);
// campos de piezas repetidas y haces de luz. Es el lenguaje de los vídeos de referencia: el mundo entero es
// estilizado, así que una figura sencilla queda intencionada y no de juguete. Todo sigue siendo función de t.
import * as THREE from 'three';

const hex = c => new THREE.Color(c);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const suave = p => p * p * (3 - 2 * p);

// ---------- mundos ----------
// cielo: 4 colores de arriba al horizonte. sol: dirección (hacia el sol), color, tamaño. niebla: [color, cerca, lejos].
// luz: la luz principal (con sombra). hemi: [cielo, suelo, fuerza] para el relleno. tono: 'neutro' respeta los colores planos.
export const MUNDOS = {
  atardecer: { cielo: ['#33407e', '#9a6aa6', '#f19a6b', '#ffd79a'], sol: { dir: [0.15, 0.06, -1], color: '#fff1c9', tam: 1 },
    niebla: ['#ffd79a', 30, 190], suelo: '#5a3a26', luz: { color: '#ffd2a1', fuerza: 2.4, dir: [-0.4, 0.5, -1] }, hemi: ['#ffcfa6', '#4a3048', 1.3] },
  dia: { cielo: ['#3f7fd8', '#6fa6e6', '#b9d6f2', '#e9f2fa'], sol: { dir: [-0.5, 0.45, -1], color: '#ffffff', tam: 0.8 },
    niebla: ['#e9f2fa', 40, 190], suelo: '#6f8f3a', luz: { color: '#fff6e5', fuerza: 2.6, dir: [-0.6, 1, 0.5] }, hemi: ['#cfe3ff', '#5b4a32', 1.4] },
  noche: { cielo: ['#07071a', '#1a1240', '#35195a', '#4a2466'], estrellas: 0.6,
    niebla: ['#4a2466', 20, 140], suelo: '#1c1626', luz: { color: '#b9a2ff', fuerza: 1.2, dir: [0.5, 1, 0.6] }, hemi: ['#5a4a9a', '#140c1e', 1.0] },
  espacio: { cielo: ['#010104', '#03040c', '#070a1a', '#0c1230'], estrellas: 1, sol: { dir: [1, 0.25, -0.6], color: '#fff6e0', tam: 0.5 },
    luz: { color: '#fff3e0', fuerza: 3.2, dir: [1, 0.25, -0.6] }, hemi: ['#3a4a7a', '#05060c', 0.5] },
  estadio: { cielo: ['#0b0a24', '#1d1650', '#2e2470', '#3a2d80'], estrellas: 0.5,
    niebla: ['#3a2d80', 25, 150], suelo: '#1a1530', luz: { color: '#e8dcff', fuerza: 1.6, dir: [0, 1, 0.4] }, hemi: ['#6a5ac0', '#120e24', 1.1] },
  azul: { cielo: ['#06101e', '#0b1a2e', '#10243d', '#16304d'],
    luz: { color: '#f2f6ff', fuerza: 2.2, dir: [0.6, 1, 0.8] }, hemi: ['#8fb4e0', '#0a1220', 0.9] },
};

const CIELO_VERT = `varying vec3 vDir;
  void main(){ vec4 p = modelMatrix * vec4(position, 1.0); vDir = p.xyz - cameraPosition;
    gl_Position = projectionMatrix * viewMatrix * p; gl_Position.z = gl_Position.w; }`;
const CIELO_FRAG = `uniform vec3 c0, c1, c2, c3, solDir, solCol; uniform float solTam, estrellas, T; varying vec3 vDir;
  float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  void main(){
    vec3 d = normalize(vDir); float y = d.y;
    vec3 c = y > 0.35 ? mix(c1, c0, smoothstep(0.35, 1.0, y)) : y > 0.08 ? mix(c2, c1, smoothstep(0.08, 0.35, y)) : mix(c3, c2, smoothstep(-0.02, 0.08, y));
    if (y < -0.02) c = mix(c3, c3 * 0.55, smoothstep(-0.02, -0.4, y));
    float s = max(dot(d, solDir), 0.0);
    c += solCol * (pow(s, 900.0 / (solTam * solTam)) * 6.0 + pow(s, 60.0) * 0.6 + pow(s, 6.0) * 0.18) * step(0.0001, solTam);
    if (estrellas > 0.0) {
      vec3 g = floor(d * 260.0); float r = h(g);
      float tw = 0.6 + 0.4 * sin(T * (1.0 + r * 3.0) + r * 40.0);
      c += vec3(smoothstep(1.0 - 0.004 * estrellas, 1.0, r)) * tw * 1.4 * smoothstep(-0.05, 0.15, y);
    }
    gl_FragColor = vec4(c, 1.0);
  }`;

export function crearEstilo({ escena, camara, sol, cada, fondo, motas, ponerDirSol, ponerTono }) {
  const lin = c => hex(c);   // THREE.Color ya pasa el hex sRGB a lineal
  let cielo = null, hemi = null, sueloMundo = null;

  // mundo(nombre, {t}): sin t, desde el principio; con t, cambia a ese mundo en ese instante (corte entre secciones).
  const agenda = [];
  let vigente = null;
  function mundo(nombre = 'atardecer', o = {}) {
    if (!MUNDOS[nombre] && !o.cielo) throw new Error(`mundo desconocido: ${nombre} (usa ${Object.keys(MUNDOS).join(', ')})`);
    const entrada = { t: o.t ?? -1, nombre, o };
    agenda.push(entrada); agenda.sort((a, b) => a.t - b.t);
    if (agenda.length === 1) cada(T => {
      let e = agenda[0]; for (const x of agenda) if (T >= x.t) e = x;
      if (e !== vigente) { vigente = e; aplicarMundo(e.nombre, e.o); }
    });
    return aplicarMundo(nombre, o);
  }
  function aplicarMundo(nombre, o) {
    const m = { ...MUNDOS[nombre], ...o };
    fondo.visible = false; motas.visible = !!o.motas;
    const u = {
      c0: { value: lin(m.cielo[0]) }, c1: { value: lin(m.cielo[1]) }, c2: { value: lin(m.cielo[2]) }, c3: { value: lin(m.cielo[3]) },
      solDir: { value: new THREE.Vector3(...(m.sol?.dir || [0, 1, 0])).normalize() }, solCol: { value: lin(m.sol?.color || '#000000') },
      solTam: { value: m.sol ? m.sol.tam : 0 }, estrellas: { value: m.estrellas || 0 }, T: { value: 0 },
    };
    if (!cielo) {
      // Esfera que sigue a la cámara y se pinta en el plano lejano: solo se ve donde no hay nada delante.
      cielo = new THREE.Mesh(new THREE.SphereGeometry(50, 48, 24), new THREE.ShaderMaterial({ uniforms: u, vertexShader: CIELO_VERT, fragmentShader: CIELO_FRAG, side: THREE.BackSide, depthWrite: false, fog: false }));
      cielo.frustumCulled = false; cielo.renderOrder = 999; cielo.userData.sinSombra = cielo.userData.ayudante = true; escena.add(cielo);
      // Se centra en la cámara justo antes de pintarse (en cada no: ahí la cámara aún no se ha movido a este fotograma).
      cielo.onBeforeRender = (r, sc, cam) => { cielo.position.copy(cam.position); cielo.updateMatrixWorld(); };
      cada(T => { cielo.material.uniforms.T.value = T; });
    } else for (const k in u) cielo.material.uniforms[k].value = u[k].value;
    escena.fog = m.niebla ? new THREE.Fog(m.niebla[0], m.niebla[1], m.niebla[2]) : null;
    if (!hemi) { hemi = new THREE.HemisphereLight(); escena.add(hemi); }
    hemi.color.set(m.hemi[0]); hemi.groundColor.set(m.hemi[1]); hemi.intensity = m.hemi[2];
    sol.color.set(m.luz.color); sol.intensity = m.luz.fuerza; ponerDirSol(new THREE.Vector3(...m.luz.dir).normalize());
    escena.environmentIntensity = 0.35;
    ponerTono(m.tono ?? 'neutro');
    if (sueloMundo) sueloMundo.visible = !!m.suelo && o.suelo !== false;
    if (m.suelo && o.suelo !== false) {
      if (!sueloMundo) {
        sueloMundo = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshLambertMaterial());
        sueloMundo.rotation.x = -Math.PI / 2; sueloMundo.receiveShadow = true; sueloMundo.userData.sinSombra = true; escena.add(sueloMundo);
      }
      sueloMundo.material.color.set(m.suelo); sueloMundo.position.y = o.sueloY ?? 0; sueloMundo.visible = true;
    }
    return { cielo, niebla: escena.fog, hemi, suelo: sueloMundo, uniformes: cielo.material.uniforms };
  }

  // ---------- materiales planos ----------
  const tonos = (() => { const t = new THREE.DataTexture(new Uint8Array([90, 170, 230, 255]), 4, 1, THREE.RedFormat); t.needsUpdate = true; return t; })();
  // Color plano con sombreado suave (Lambert). duro: true → sombreado por bandas (cel shading). emisivo: brilla con luz propia.
  const plano = (color, { duro = false, emisivo = 0 } = {}) => {
    const m = duro ? new THREE.MeshToonMaterial({ color, gradientMap: tonos }) : new THREE.MeshLambertMaterial({ color });
    if (emisivo) { m.emissive = hex(color); m.emissiveIntensity = emisivo; }
    return m;
  };

  // ---------- personas ----------
  // Proporciones de una persona de 1,8 de alto, sin cara (como en las referencias). Las piezas giran en sus articulaciones.
  const G = {
    pierna: new THREE.CapsuleGeometry(0.075, 0.74, 4, 10).translate(0, -0.445, 0),
    torso: new THREE.CapsuleGeometry(0.17, 0.34, 4, 14).scale(1.12, 1, 0.72),
    brazo: new THREE.CapsuleGeometry(0.052, 0.5, 4, 8).translate(0, -0.28, 0),
    cabeza: new THREE.SphereGeometry(0.125, 18, 14).scale(0.92, 1.05, 0.95),
    cuello: new THREE.CylinderGeometry(0.05, 0.055, 0.08, 10),
    pelo: new THREE.SphereGeometry(0.132, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.52).scale(0.94, 1.05, 0.98),
    ala: new THREE.CylinderGeometry(0.25, 0.25, 0.018, 24), copa: new THREE.CylinderGeometry(0.1, 0.12, 0.1, 18),
    // astronauta: más voluminoso
    aPierna: new THREE.CapsuleGeometry(0.13, 0.52, 4, 12).translate(0, -0.4, 0),
    aTorso: new THREE.CapsuleGeometry(0.25, 0.26, 4, 16).scale(1.08, 1, 0.85),
    aBrazo: new THREE.CapsuleGeometry(0.095, 0.42, 4, 10).translate(0, -0.27, 0),
    casco: new THREE.SphereGeometry(0.23, 28, 20),
    visor: new THREE.SphereGeometry(0.22, 28, 18, Math.PI * 0.12, Math.PI * 0.76, Math.PI * 0.3, Math.PI * 0.36),
    mochila: new THREE.BoxGeometry(0.4, 0.5, 0.2), panel: new THREE.BoxGeometry(0.2, 0.12, 0.05),
    bota: new THREE.CapsuleGeometry(0.11, 0.1, 4, 10).rotateX(Math.PI / 2).translate(0, 0, 0.04),
    guante: new THREE.SphereGeometry(0.1, 12, 10),
    anillo: new THREE.TorusGeometry(0.115, 0.024, 8, 20).rotateX(Math.PI / 2),
    // multitudes: las mismas piezas con pocos polígonos (de lejos no se nota y son miles)
    mTorso: new THREE.CapsuleGeometry(0.17, 0.34, 2, 7).scale(1.12, 1, 0.72), mPierna: new THREE.CapsuleGeometry(0.075, 0.74, 1, 5).translate(0, -0.445, 0),
    mBrazo: new THREE.CapsuleGeometry(0.052, 0.5, 1, 5).translate(0, -0.28, 0), mCabeza: new THREE.SphereGeometry(0.125, 8, 6).scale(0.92, 1.05, 0.95),
    mAla: new THREE.CylinderGeometry(0.25, 0.25, 0.018, 10), mCopa: new THREE.CylinderGeometry(0.1, 0.12, 0.1, 7),
  };
  const Y = { cadera: 0.9, hombro: 1.44, torso: 1.2, cabeza: 1.64 };

  // Pose = ángulos de las articulaciones en t. fase desincroniza a cada persona.
  function pose(nombre, T, fase = 0, ritmo = 1) {
    const w = T * ritmo + fase, r = { bI: [0, 0.08], bD: [0, -0.08], pI: 0, pD: 0, y: 0, inclina: 0, giro: 0, cabeza: 0 };
    if (nombre === 'andar') {
      const s = Math.sin(w * 6.5);
      r.pI = s * 0.5; r.pD = -s * 0.5; r.bI = [-s * 0.45, 0.1]; r.bD = [s * 0.45, -0.1]; r.y = Math.abs(Math.cos(w * 6.5)) * 0.04;
    } else if (nombre === 'animar') {
      const s = Math.sin(w * 7);
      r.bI = [0.2, 2.75 + s * 0.25]; r.bD = [0.2, -2.75 + s * 0.25]; r.y = Math.max(0, Math.sin(w * 7)) * 0.08;
    } else if (nombre === 'trabajar') {
      const s = Math.sin(w * 3);
      r.inclina = 0.35; r.bI = [-0.9 - s * 0.35, 0.15]; r.bD = [-0.9 - s * 0.35, -0.15]; r.cabeza = 0.25;
    } else if (nombre === 'flotar') {
      r.bI = [0.3 + Math.sin(w * 0.9) * 0.25, 0.7]; r.bD = [-0.2 + Math.sin(w * 0.8 + 1) * 0.25, -0.6];
      r.pI = 0.25 + Math.sin(w * 0.7) * 0.18; r.pD = -0.15 + Math.sin(w * 0.6 + 2) * 0.18;
    } else if (nombre === 'senalar') {
      r.bD = [-1.45, -0.2]; r.cabeza = 0;
    } else {   // quieto: respira y se balancea apenas
      const s = Math.sin(w * 1.6);
      r.bI = [s * 0.03, 0.09]; r.bD = [-s * 0.03, -0.09]; r.y = s * 0.005;
    }
    return r;
  }
  const mezclar = (a, b, k) => {
    const o = {};
    for (const key in a) o[key] = Array.isArray(a[key]) ? a[key].map((v, i) => v + (b[key][i] - v) * k) : a[key] + (b[key] - a[key]) * k;
    return o;
  };
  const poseEn = (lista, T, fase, ritmo) => {
    let i = 0; while (i + 1 < lista.length && T >= lista[i + 1][0]) i++;
    const actual = pose(lista[i][1], T, fase, ritmo);
    if (i === 0) return actual;
    const k = clamp((T - lista[i][0]) / 0.35);
    return k >= 1 ? actual : mezclar(pose(lista[i - 1][1], T, fase, ritmo), actual, suave(k));
  };

  // Una persona (o un astronauta) como grupo animable. poses: [[t, 'quieto'], [t2, 'andar'], …]; ritmo: velocidad.
  function persona({ ropa = '#3f6fd8', pantalon = '#2a2f3a', piel = '#d9a37a', pelo = '#2b1d14', sombrero = false, traje = null,
    poses = [[0, 'quieto']], ritmo = 1, fase = 0, altura = 1.8, reloj = null } = {}) {
    const g = new THREE.Group(), astro = traje === 'astronauta';
    const mRopa = astro ? new THREE.MeshStandardMaterial({ color: '#f1f2f4', roughness: 0.7 }) : plano(ropa);
    const mPant = astro ? mRopa : plano(pantalon), mPiel = plano(piel), mGris = astro ? new THREE.MeshStandardMaterial({ color: '#9aa0aa', roughness: 0.5 }) : null;
    const pieza = (geo, mat, padre = g, pos = [0, 0, 0]) => { const m = new THREE.Mesh(geo, mat); m.position.set(...pos); padre.add(m); return m; };
    const cuerpo = new THREE.Group(); g.add(cuerpo);
    const torso = pieza(astro ? G.aTorso : G.torso, mRopa, cuerpo, [0, Y.torso, 0]);
    const cab = new THREE.Group(); cab.position.y = Y.cabeza - 0.1; cuerpo.add(cab);
    const art = {};
    for (const [lado, s] of [['I', 1], ['D', -1]]) {
      const hombro = new THREE.Group(); hombro.position.set(0.215 * s * (astro ? 1.15 : 1), Y.hombro, 0); cuerpo.add(hombro);
      pieza(astro ? G.aBrazo : G.brazo, mRopa, hombro);
      if (astro) { pieza(G.guante, mGris, hombro, [0, -0.6, 0]); pieza(G.anillo, mGris, hombro, [0, -0.5, 0]); }
      else pieza(new THREE.SphereGeometry(0.05, 10, 8), mPiel, hombro, [0, -0.58, 0]);
      const cadera = new THREE.Group(); cadera.position.set((astro ? 0.12 : 0.09) * s, Y.cadera, 0); g.add(cadera);
      pieza(astro ? G.aPierna : G.pierna, mPant, cadera);
      if (astro) { pieza(G.bota, mGris, cadera, [0, -0.8, 0]); pieza(G.anillo, mGris, cadera, [0, -0.62, 0]).scale.setScalar(1.15); }
      art['h' + lado] = hombro; art['c' + lado] = cadera;
    }
    if (astro) {
      pieza(G.casco, mRopa, cab, [0, 0.12, 0]);
      const visor = pieza(G.visor, new THREE.MeshStandardMaterial({ color: '#d9a640', metalness: 1, roughness: 0.12 }), cab, [0, 0.13, 0.02]);
      visor.scale.setScalar(1.01);
      pieza(G.mochila, mRopa, cuerpo, [0, Y.torso + 0.05, -0.27]);
      const panel = pieza(G.panel, mGris, cuerpo, [0, Y.torso + 0.08, 0.2]);
      for (const [x, c] of [[-0.06, '#ff4d5e'], [0, '#3ddc84'], [0.06, '#4f7dff']]) pieza(new THREE.BoxGeometry(0.035, 0.035, 0.02), plano(c, { emisivo: 0.8 }), panel, [x, 0, 0.03]);
      pieza(new THREE.CylinderGeometry(0.11, 0.13, 0.08, 18), mGris, cuerpo, [0, Y.hombro + 0.05, 0]);
    } else {
      pieza(G.cuello, mPiel, cab, [0, -0.04, 0]);
      pieza(G.cabeza, mPiel, cab, [0, 0.1, 0]);
      if (sombrero) { pieza(G.ala, plano(typeof sombrero === 'string' ? sombrero : '#d9b25f'), cab, [0, 0.2, 0]); pieza(G.copa, plano(typeof sombrero === 'string' ? sombrero : '#d9b25f'), cab, [0, 0.27, 0]); }
      else if (pelo) pieza(G.pelo, plano(pelo), cab, [0, 0.11, -0.005]);
    }
    g.scale.setScalar(altura / 1.8);
    g.userData = { poses, ritmo, fase, partes: { cuerpo, cab, torso, ...art } };
    const aplicar = T => {
      const p = poseEn(g.userData.poses, reloj ? reloj(T) : T, g.userData.fase, g.userData.ritmo);   // reloj: t → tiempo propio (cámara lenta sin saltos)
      art.hI.rotation.set(p.bI[0], 0, p.bI[1]); art.hD.rotation.set(p.bD[0], 0, p.bD[1]);
      art.cI.rotation.x = p.pI; art.cD.rotation.x = p.pD;
      cuerpo.rotation.x = p.inclina; cab.rotation.x = p.cabeza; cuerpo.position.y = p.y; art.cI.position.y = art.cD.position.y = Y.cadera + p.y;
    };
    aplicar(0); cada(aplicar);
    return g;
  }

  // ---------- multitudes ----------
  // n personas repartidas en un rectángulo [ancho, fondo] alrededor de centro. pose: 'quieto' | 'animar' | 'andar' | 'trabajar'.
  // Se dibujan con InstancedMesh (una malla por pieza): miles cuestan poco. colores: ropa variada; sombrero: true para el campo.
  function multitud({ n = 300, centro = [0, 0, 0], area = [20, 20], pose: nombre = 'quieto', colores = ['#e8a33d', '#3f6fd8', '#f2f2f2', '#d64545', '#3ddc84', '#a46bff'],
    pieles = ['#e0ac80', '#c68642', '#8d5524', '#f1c27d'], pantalones = ['#2a2f3a', '#3a2c22', '#1f3a2a'], sombrero = false, escala = 1, semilla = 3, mirar = null, sombra = false } = {}) {
    let s = semilla; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const gente = Array.from({ length: n }, () => ({
      x: centro[0] + (r() - 0.5) * area[0], z: centro[2] + (r() - 0.5) * area[1], rot: (r() - 0.5) * 0.6, h: escala * (0.9 + r() * 0.2), fase: r() * 10, ritmo: 0.85 + r() * 0.3,
      ropa: colores[Math.floor(r() * colores.length)], piel: pieles[Math.floor(r() * pieles.length)], pant: pantalones[Math.floor(r() * pantalones.length)],
    }));
    const grupo = new THREE.Group(), base = new THREE.MeshLambertMaterial({ color: '#ffffff' });
    const capa = (geo, color) => {
      const m = new THREE.InstancedMesh(geo, base, n); m.frustumCulled = false; m.userData.sinSombra = !sombra;
      gente.forEach((p, i) => m.setColorAt(i, hex(color(p)))); grupo.add(m); return m;
    };
    const capas = {
      torso: capa(G.mTorso, p => p.ropa), cabeza: capa(G.mCabeza, p => p.piel), bI: capa(G.mBrazo, p => p.ropa), bD: capa(G.mBrazo, p => p.ropa),
      pI: capa(G.mPierna, p => p.pant), pD: capa(G.mPierna, p => p.pant),
      ...(sombrero ? { ala: capa(G.mAla, () => '#d9b25f'), copa: capa(G.mCopa, () => '#d9b25f') } : {}),
    };
    const M = new THREE.Matrix4(), B = new THREE.Matrix4(), L = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), uno = new THREE.Vector3(1, 1, 1);
    const local = (x, y, z, rx = 0, rz = 0) => L.compose(v.set(x, y, z), q.setFromEuler(e.set(rx, 0, rz)), uno);
    grupo.userData = { pose: nombre };
    const aplicar = T => {
      gente.forEach((p, i) => {
        const a = pose(grupo.userData.pose, T, p.fase, p.ritmo), giro = mirar ? Math.atan2(mirar[0] - p.x, mirar[2] - p.z) : p.rot;
        B.compose(v.set(p.x, centro[1] + a.y * p.h, p.z), q.setFromEuler(e.set(0, giro, 0)), new THREE.Vector3(p.h, p.h, p.h));
        const pon = (m, x, y, z, rx, rz) => { M.multiplyMatrices(B, local(x, y, z, rx, rz)); m.setMatrixAt(i, M); };
        pon(capas.torso, 0, Y.torso, 0, a.inclina, 0); pon(capas.cabeza, 0, Y.cabeza, 0.12 * Math.sin(a.inclina), a.cabeza, 0);
        pon(capas.bI, 0.215, Y.hombro, 0, a.bI[0], a.bI[1]); pon(capas.bD, -0.215, Y.hombro, 0, a.bD[0], a.bD[1]);
        pon(capas.pI, 0.09, Y.cadera, 0, a.pI, 0); pon(capas.pD, -0.09, Y.cadera, 0, a.pD, 0);
        if (capas.ala) { pon(capas.ala, 0, Y.cabeza + 0.1, 0, a.cabeza, 0); pon(capas.copa, 0, Y.cabeza + 0.17, 0, a.cabeza, 0); }
      });
      for (const m of Object.values(capas)) m.instanceMatrix.needsUpdate = true;
    };
    aplicar(0); cada(aplicar);
    escena.add(grupo);
    return grupo;
  }

  // ---------- campos de piezas repetidas ----------
  // Rejilla de filas × columnas con paso [dx, dz] (plantas, butacas, trofeos, ventanas…), con algo de azar para que no parezca copiada.
  // Devuelve la InstancedMesh; .aparecer(t, dur) la hace crecer de cerca a lejos.
  // escala: tamaño uniforme [mín, máx]; alto: además, estira solo en vertical [mín, máx] (edificios, columnas); girar: false los deja alineados.
  function repetir({ geometria, material, filas = 10, columnas = 10, paso = [1, 1], centro = [0, 0, 0], azar = 0.15, escala = [0.85, 1.15], alto = [1, 1], girar = true, semilla = 7, sombra = false }) {
    let s = semilla; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const n = filas * columnas, m = new THREE.InstancedMesh(geometria, material, n), datos = [];
    for (let f = 0; f < filas; f++) for (let c = 0; c < columnas; c++) {
      datos.push({ x: centro[0] + (c - (columnas - 1) / 2) * paso[0] + (r() - 0.5) * azar * paso[0], z: centro[2] + (f - (filas - 1) / 2) * paso[1] + (r() - 0.5) * azar * paso[1],
        rot: girar ? r() * Math.PI * 2 : 0, e: escala[0] + r() * (escala[1] - escala[0]), a: alto[0] + r() * (alto[1] - alto[0]) });
    }
    const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), k = new THREE.Vector3();
    const colocar = (factor = () => 1) => { datos.forEach((d, i) => { const f = factor(d); m.setMatrixAt(i, M.compose(v.set(d.x, centro[1], d.z), q.setFromEuler(e.set(0, d.rot, 0)), k.set(1, d.a, 1).multiplyScalar(d.e * Math.max(f, 0.0001)))); }); m.instanceMatrix.needsUpdate = true; };
    colocar(); m.frustumCulled = false; m.userData.sinSombra = !sombra; escena.add(m);
    m.aparecer = (t, dur = 1.5, origen = [centro[0], centro[2]]) => {
      const dist = d => Math.hypot(d.x - origen[0], d.z - origen[1]), maxD = Math.max(...datos.map(dist)) || 1;
      cada(T => { if (T < t - 0.1 || T > t + dur + 0.6) { if (T < t) colocar(() => 0); return; } colocar(d => { const k2 = clamp((T - t - (dist(d) / maxD) * dur) / 0.45); return 1 + 2.70158 * Math.pow(k2 - 1, 3) + 1.70158 * Math.pow(k2 - 1, 2); }); });
      cada(T => { if (T > t + dur + 0.6) colocar(); });
      return m;
    };
    return m;
  }

  // ---------- haces de luz ----------
  // Cono de luz visible (focos de estadio, linterna, rayo de sol entre nubes). Aditivo, se desvanece hacia la punta y en los bordes.
  function foco({ desde = [0, 10, 0], hacia = [0, 0, 0], color = '#ffffff', ancho = 1.6, opacidad = 0.28 } = {}) {
    const a = new THREE.Vector3(...desde), b = new THREE.Vector3(...hacia), largo = a.distanceTo(b);
    const geo = new THREE.CylinderGeometry(0.02, ancho, largo, 32, 1, true).translate(0, -largo / 2, 0);
    const mat = new THREE.ShaderMaterial({
      uniforms: { color: { value: hex(color) }, opacidad: { value: opacidad }, largo: { value: largo } },
      vertexShader: `varying float vL; varying vec3 vN, vV; uniform float largo;
        void main(){ vL = -position.y / largo; vec4 p = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-p.xyz); gl_Position = projectionMatrix * p; }`,
      fragmentShader: `uniform vec3 color; uniform float opacidad; varying float vL; varying vec3 vN, vV;
        void main(){ float borde = abs(dot(vN, vV)); gl_FragColor = vec4(color * opacidad * borde * (1.0 - 0.8 * vL), 1.0); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    });
    const m = new THREE.Mesh(geo, mat); m.position.copy(a); m.userData.sinSombra = m.userData.ayudante = true;
    m.lookAt(b); m.rotateX(-Math.PI / 2);
    escena.add(m); return m;
  }

  return { mundo, plano, persona, multitud, repetir, foco, MUNDOS };
}
