// ¿Por qué una olla exprés cocina tan rápido? El aire de encima aprieta el agua: con menos aire (Everest) hierve a 70 °C;
// la olla atrapa el vapor, dobla la presión (2 atm) y el agua no hierve hasta 120 °C: hasta 3 veces más rápido.
// Tres secciones: cocina con un cazo (0-3), cima del Everest (4-5) y cocina con la olla exprés (6-15).
export default function crear(ctx) {
  const { THREE, escena, f, fin, palabra, tween, cada, mat, geo, ui, camara, mundo, dof, halo, frases, sombras, sonido, persona, azar, bordes, fx } = ctx;
  const AMARILLO = '#ffd23f';
  mundo('atardecer', { sueloY: -1.3 });
  mundo('dia', { t: f(4), suelo: false, cielo: ['#163f96', '#2f6cc8', '#7fb0e6', '#cfe2f6'], niebla: ['#cfe2f6', 40, 190] });   // cielo de altura, más oscuro
  mundo('atardecer', { t: f(6), sueloY: -1.3 });
  dof.apertura = 0.45; dof.resplandor = 0.5; dof.tono = 'neutro';
  const seccion = T => (T < f(4) ? 0 : T < f(6) ? 1 : 2);

  // ---------- utilidades ----------
  const S = 64;
  // Medio torno (corte): delante = la mitad que mira a cámara (+z), detrás = la otra.
  const medio = (perfil, delante, seg = 40) => new THREE.LatheGeometry(perfil.map(([r, y]) => new THREE.Vector2(r, y)), seg, delante ? -Math.PI / 2 : Math.PI / 2, Math.PI);
  const transparente = m => { m.transparent = true; return m; };
  // acero satinado: medio metálico para que lo ilumine el mundo (el metal puro solo refleja las cajas de luz y sale negro)
  const acero = (color = 0xd6dce3) => new THREE.MeshStandardMaterial({ color, metalness: 0.45, roughness: 0.3 });
  // Burbujas que suben por el agua: InstancedMesh, hervor 0..1 decide cuántas.
  function burbujas(padre, { radio, y0, alto, n = 36, tam = 0.07, semilla = 5, vel = 0.9 }) {
    const r = azar(semilla), datos = Array.from({ length: n }, () => ({ a: r() * 6.283, d: Math.sqrt(r()) * radio * 0.85, fase: r(), v: vel * (0.7 + r() * 0.6), s: 0.6 + r() * 0.8 }));
    const malla = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshStandardMaterial({ color: '#eaf7ff', roughness: 0.1, transparent: true, opacity: 0.75 }), n);
    malla.userData.sinSombra = true; malla.frustumCulled = false; padre.add(malla);
    const estado = { hervor: 0 }, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
    cada(T => {
      malla.count = Math.round(n * Math.min(1, Math.max(0, estado.hervor)));
      for (let i = 0; i < malla.count; i++) {
        const b = datos[i], k = (T * b.v + b.fase) % 1;
        p.set(Math.cos(b.a) * b.d + Math.sin(T * 5 + i) * 0.02, y0 + k * alto, Math.sin(b.a) * b.d);
        s.setScalar(tam * b.s * (0.45 + k * 0.8));
        malla.setMatrixAt(i, m4.compose(p, q, s));
      }
      malla.instanceMatrix.needsUpdate = true;
    });
    return estado;
  }
  // Vapor: bocanadas (halos blancos) que suben desde un punto; fuerza 0..1.
  function vapor(padre, { pos, n = 4, alto = 1.2, tam = 0.6, vel = 0.5, semilla = 2 }) {
    const r = azar(semilla), est = { fuerza: 0 };
    const hs = Array.from({ length: n }, (_, i) => { const h = halo(padre, { color: '#ffffff', tam, opacidad: 0 }); h.material.blending = THREE.NormalBlending; return { h, fase: i / n, dx: (r() - 0.5) * 0.3 }; });
    cada(T => hs.forEach(({ h, fase, dx }) => {
      const k = (T * vel + fase) % 1;
      h.position.set(pos[0] + dx * k, pos[1] + k * alto, pos[2]); h.scale.setScalar(tam * (0.5 + k * 1.1));
      h.material.opacity = est.fuerza * 0.55 * Math.sin(k * Math.PI);
    }));
    return est;
  }

  // ---------- cocina: encimera, azulejos, placa con fuego ----------
  const cocina = new THREE.Group(); escena.add(cocina);
  const encimera = new THREE.Mesh(geo.caja(11, 1.2, 4.8, 0.06), mat.plano('#2e3b57')); encimera.position.set(0, -0.6, 0); cocina.add(encimera);
  const canto = new THREE.Mesh(geo.caja(11.04, 0.08, 4.84, 0.03), mat.plano('#d9c7a8')); canto.position.set(0, -0.02, 0); cocina.add(canto);
  const pared = new THREE.Mesh(new THREE.PlaneGeometry(11, 3.2), mat.pintado((g, w, h) => {
    g.fillStyle = '#1d4250'; g.fillRect(0, 0, w, h);
    const cx = 22, cy = 8, aw = w / cx, ah = h / cy;
    for (let i = 0; i < cx; i++) for (let j = 0; j < cy; j++) {
      const gr = g.createLinearGradient(i * aw, j * ah, (i + 1) * aw, (j + 1) * ah); gr.addColorStop(0, '#2c6274'); gr.addColorStop(1, '#22505f');
      g.fillStyle = gr; g.beginPath(); g.roundRect(i * aw + 4, j * ah + 4, aw - 8, ah - 8, 6); g.fill();
    }
  }, { w: 2048, h: 600, rugosidad: 0.35 })); pared.position.set(0, 1.6, -2.4); cocina.add(pared);
  const placa = new THREE.Mesh(geo.caja(3.4, 0.05, 2.7, 0.02), mat.plastico(0x111216, 0.12)); placa.position.set(0, 0.0, 0); cocina.add(placa);
  // fogón de gas: corona oscura y lenguas de llama azul
  const corona = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.56, 0.08, S), mat.metal(0x2a2c31, 0.4)); corona.position.y = 0.06; cocina.add(corona);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4, bar = new THREE.Mesh(geo.caja(0.75, 0.05, 0.08, 0.02), mat.plastico(0x1a1b1f, 0.5));
    bar.position.set(Math.cos(a) * 0.62, 0.1, Math.sin(a) * 0.62); bar.rotation.y = -a; cocina.add(bar);
  }
  const N_LL = 22, llamas = new THREE.InstancedMesh(new THREE.ConeGeometry(0.05, 0.11, 8).translate(0, 0.055, 0), mat.plano('#5aa0ff', { emisivo: 1.6 }), N_LL);
  llamas.userData.sinSombra = true; llamas.frustumCulled = false; cocina.add(llamas);
  { const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
    cada(T => { for (let i = 0; i < N_LL; i++) { const a = (i / N_LL) * 6.283; p.set(Math.cos(a) * 0.5, 0.04, Math.sin(a) * 0.5); s.set(1, 0.8 + 0.3 * Math.sin(T * 13 + i * 2.1), 1); llamas.setMatrixAt(i, m4.compose(p, q, s)); } llamas.instanceMatrix.needsUpdate = true; }); }

  // ---------- termómetro grande junto al fuego ----------
  const termo = new THREE.Group(); termo.position.set(-1.65, 0, -0.95); termo.rotation.y = 0.25; cocina.add(termo);
  const yT = t => 0.6 + (t / 130) * 2.25;   // temperatura → altura de la columna
  termo.add(new THREE.Mesh(geo.torno([[0, 0], [0.3, 0], [0.32, 0.05], [0.28, 0.12], [0, 0.12]], S), mat.plastico(0x2b2e36, 0.4)));
  const escalaT = new THREE.Mesh(geo.caja(0.62, 2.9, 0.06, 0.03), mat.pintado((g, w, h) => {
    g.fillStyle = '#f4f1ea'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2a2d35'; g.textAlign = 'right'; g.font = `700 ${w * 0.16}px "Inter"`;
    for (let t = 0; t <= 130; t += 10) {
      const y = h - ((yT(t) - 0.12) / 2.9) * h, mayor = t % 20 === 0;
      g.fillRect(w * 0.6, y - 2, mayor ? w * 0.3 : w * 0.18, 4);
      if (mayor) g.fillText(String(t), w * 0.55, y + w * 0.055);
    }
    g.fillStyle = '#ff4d5e'; g.fillRect(w * 0.6, h - ((yT(120) - 0.12) / 2.9) * h - 4, w * 0.36, 8);
  }, { w: 256, h: 1200, rugosidad: 0.5 })); escalaT.position.set(-0.2, 0.12 + 1.45, -0.06); termo.add(escalaT);
  const tubo = new THREE.Mesh(geo.torno([[0, 0.3], [0.09, 0.42], [0.1, 0.55], [0.1, 2.95], [0.07, 3.05], [0, 3.07]], 32), mat.vidrio('#dff4ff', 0.14));
  termo.add(tubo); bordes(tubo, { color: '#ffffff', opacidad: 0.25 });
  const bulbo = new THREE.Mesh(new THREE.SphereGeometry(0.17, 32, 20), mat.plano('#ff3b3b', { emisivo: 0.25 })); bulbo.position.y = 0.42; termo.add(bulbo);
  const columna = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1, 20).translate(0, 0.5, 0), mat.plano('#ff3b3b', { emisivo: 0.25 })); columna.position.y = 0.5; termo.add(columna);
  const temp = { v: 100 };
  cada(() => { columna.scale.y = yT(temp.v) - 0.5; });

  // ---------- cazo en corte (sección 1) ----------
  const cazo = new THREE.Group(); cazo.position.y = 0.13; cocina.add(cazo);
  const PERFIL_CAZO = [[0, 0], [0.95, 0], [1.0, 0.04], [1.02, 0.95], [1.06, 1.0], [1.0, 1.0], [0.96, 0.95], [0.94, 0.06], [0, 0.06]];
  const metalCazo = acero(), metalDelante = transparente(acero());
  cazo.add(new THREE.Mesh(medio(PERFIL_CAZO, false), metalCazo));
  const cazoDelante = new THREE.Mesh(medio(PERFIL_CAZO, true), metalDelante); cazo.add(cazoDelante);
  const fondoCazo = new THREE.Mesh(new THREE.CylinderGeometry(0.97, 0.97, 0.06, S), acero(0xaeb5be)); fondoCazo.position.y = 0.03; cazo.add(fondoCazo);
  const mango = new THREE.Mesh(geo.caja(1.5, 0.1, 0.18, 0.05), mat.plastico(0x1d1f24, 0.4)); mango.position.set(1.65, 0.92, -0.55); mango.rotation.y = 0.5; mango.rotation.z = 0.12; cazo.add(mango);
  const aguaMat = () => new THREE.MeshStandardMaterial({ color: '#3d8ee0', roughness: 0.08, transparent: true, opacity: 0.55, depthWrite: false });
  const agua = new THREE.Mesh(new THREE.CylinderGeometry(0.93, 0.93, 0.72, S), aguaMat()); agua.position.y = 0.42; cazo.add(agua);
  const hervorCazo = burbujas(cazo, { radio: 0.93, y0: 0.1, alto: 0.68, n: 50, tam: 0.05 });
  const vaporCazo = vapor(cazo, { pos: [0, 1.0, 0], n: 4, alto: 1.4, tam: 0.8 });
  // aire de encima: bloques translúcidos apilados que aprietan
  const bloqueGeo = geo.caja(1.8, 0.5, 1.8, 0.08);
  const bloques = [0, 1, 2, 3, 4].map(i => {
    const b = new THREE.Mesh(bloqueGeo, new THREE.MeshStandardMaterial({ color: '#a9dcff', roughness: 0.3, transparent: true, opacity: 0.32, depthWrite: false }));
    b.userData.sinSombra = true; bordes(b, { color: '#d6f0ff', opacidad: 0.7 });
    b.position.set(0, 1.42 + 0.25 + i * 0.56 + 8, 0); cazo.add(b); return b;
  });
  const cae = (b, t, i) => tween(b.position, { y: 1.42 + 0.25 + i * 0.56 }, { t, dur: 0.6, ease: 'muelle' });

  // ---------- olla exprés (sección 3) ----------
  const olla = new THREE.Group(); olla.position.y = 0.13; cocina.add(olla);
  const PERFIL_OLLA = [[0, 0], [1.12, 0], [1.16, 0.05], [1.16, 1.28], [1.2, 1.33], [1.14, 1.34], [1.1, 1.28], [1.1, 0.08], [0, 0.08]];
  const aceroOlla = acero(), aceroDelante = transparente(acero());
  olla.add(new THREE.Mesh(medio(PERFIL_OLLA, false, 56), aceroOlla));
  const ollaDelante = new THREE.Mesh(medio(PERFIL_OLLA, true, 56), aceroDelante); olla.add(ollaDelante);
  const fondoDifusor = new THREE.Mesh(new THREE.CylinderGeometry(1.12, 1.12, 0.09, S), acero(0xaeb5be)); fondoDifusor.position.y = 0.035; olla.add(fondoDifusor);
  const negro = mat.plastico(0x1b1d22, 0.38);
  const mangoOlla = new THREE.Mesh(geo.caja(1.35, 0.16, 0.28, 0.07), negro); mangoOlla.position.set(1.8, 1.18, 0); olla.add(mangoOlla);
  const asaOlla = new THREE.Mesh(geo.caja(0.42, 0.12, 0.34, 0.05), negro); asaOlla.position.set(-1.35, 1.18, 0); olla.add(asaOlla);
  const aguaOlla = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 1.08, 0.7, S), aguaMat()); aguaOlla.position.y = 0.44; olla.add(aguaOlla);
  const hervorOlla = burbujas(olla, { radio: 1.08, y0: 0.12, alto: 0.66, n: 54, tam: 0.05, semilla: 9 });
  // vapor atrapado: bolitas que rebotan en el hueco entre el agua y la tapa
  const N_V = 34, rv = azar(13), vapores = Array.from({ length: N_V }, () => [rv(), rv(), rv(), 0.6 + rv() * 0.8, 0.6 + rv() * 0.8, 0.6 + rv() * 0.8]);
  const bolas = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 12, 8), new THREE.MeshBasicMaterial({ color: '#f4fbff', transparent: true, opacity: 0.9 }), N_V); bolas.userData.sinSombra = true; bolas.frustumCulled = false; olla.add(bolas);
  const presion = { v: 1, vapor: 0 };
  { const tri = u => 1 - 4 * Math.abs((((u % 1) + 1) % 1) - 0.5), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
    cada(T => {
      bolas.count = Math.round(N_V * presion.vapor);
      for (let i = 0; i < bolas.count; i++) {
        const [a, b, c, va, vb, vc] = vapores[i];
        p.set(tri(T * 0.9 * va + a) * 0.72, 1.12 + tri(T * 1.1 * vb + b) * 0.2, tri(T * 0.8 * vc + c) * 0.72);
        bolas.setMatrixAt(i, m4.compose(p, q, s));
      }
      bolas.instanceMatrix.needsUpdate = true;
    }); }
  // tapa: cúpula con goma, mango, válvula con peso y manómetro
  const tapa = new THREE.Group(); olla.add(tapa);
  const PERFIL_TAPA = [[0, 0.62], [0.35, 0.6], [0.8, 0.48], [1.1, 0.26], [1.2, 0.08], [1.22, 0.0], [1.16, 0.0], [1.12, 0.07], [0.78, 0.42], [0.35, 0.54], [0, 0.56]];
  const tapaDetras = new THREE.Mesh(medio(PERFIL_TAPA, false, 56), aceroOlla); tapa.add(tapaDetras);
  const tapaDelante = new THREE.Mesh(medio(PERFIL_TAPA, true, 56), aceroDelante); tapa.add(tapaDelante);
  const gomaGeo = new THREE.TorusGeometry(1.15, 0.03, 8, S / 2, Math.PI).rotateX(Math.PI / 2), gomaDelante = transparente(mat.goma(0xc4462e));
  const goma = new THREE.Mesh(gomaGeo.clone().rotateY(Math.PI), mat.goma(0xc4462e)); goma.position.y = 0.03; tapa.add(goma);
  const goma2 = new THREE.Mesh(gomaGeo, gomaDelante); goma2.position.y = 0.03; tapa.add(goma2);
  cada(() => { gomaDelante.opacity = aceroDelante.opacity; goma2.visible = aceroDelante.opacity > 0.01; });
  tapa.position.y = 1.32;
  const mangoTapa = new THREE.Mesh(geo.caja(1.3, 0.14, 0.26, 0.06), negro); mangoTapa.position.set(1.72, 0.08, 0); tapa.add(mangoTapa);
  const puente = new THREE.Mesh(geo.caja(0.9, 0.1, 0.22, 0.04), negro); puente.position.set(0.95, 0.26, 0); puente.rotation.z = -0.38; tapa.add(puente);
  const chimenea = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.16, 24), mat.metal(0xbfc5cc, 0.3)); chimenea.position.set(0, 0.68, 0); tapa.add(chimenea);
  const peso = new THREE.Group(); peso.position.set(0, 0.76, 0); tapa.add(peso);
  peso.add(new THREE.Mesh(geo.torno([[0, 0], [0.16, 0], [0.17, 0.05], [0.12, 0.12], [0.06, 0.16], [0, 0.17]], 32), mat.metalPulido(0xdfe3e8, 0.15)));
  const VALVULA = [0, 1.32 + 0.9, 0];
  // manómetro de presión
  const mano = new THREE.Group(); mano.position.set(-0.55, 0.52, 0.45); mano.rotation.set(-0.75, 0.3, 0); tapa.add(mano);
  mano.add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.08, 40).rotateX(Math.PI / 2), mat.metal(0xb9c0c8, 0.3)));
  const cara = new THREE.Mesh(new THREE.CircleGeometry(0.19, 48), mat.pintado((g, w, h) => {
    g.fillStyle = '#f7f5ef'; g.beginPath(); g.arc(w / 2, h / 2, w / 2, 0, 7); g.fill();
    const c = w / 2, R = w * 0.42, ang = p => (135 + p * 90) * Math.PI / 180;
    g.lineWidth = w * 0.05; g.strokeStyle = '#ff4d5e'; g.beginPath(); g.arc(c, c, R, ang(2.4), ang(3)); g.stroke();
    g.fillStyle = '#20232a'; g.textAlign = 'center'; g.font = `800 ${w * 0.15}px "Inter"`;
    for (let p = 0; p <= 3; p += 0.25) { const a = ang(p), l = p % 1 === 0 ? 0.13 : 0.07; g.lineWidth = w * (p % 1 === 0 ? 0.025 : 0.012); g.strokeStyle = '#20232a';
      g.beginPath(); g.moveTo(c + Math.cos(a) * R, c + Math.sin(a) * R); g.lineTo(c + Math.cos(a) * (R - w * l), c + Math.sin(a) * (R - w * l)); g.stroke();
      if (p % 1 === 0) g.fillText(String(p), c + Math.cos(a) * R * 0.6, c + Math.sin(a) * R * 0.6 + w * 0.05); }
    g.font = `700 ${w * 0.09}px "Inter"`; g.fillText('atm', c, c + w * 0.3);
  }, { w: 256, h: 256, rugosidad: 0.3 })); cara.position.z = 0.045; mano.add(cara);
  const aguja = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.014, 0.01).translate(0.065, 0, 0), mat.plano('#e2242f')); aguja.position.z = 0.055; mano.add(aguja);
  cada(() => { aguja.rotation.z = -((135 + presion.v * 90) * Math.PI) / 180; });
  const vaporValvula = vapor(olla, { pos: [0, 2.25, 0], n: 6, alto: 2.0, tam: 0.7, vel: 1.1, semilla: 4 });

  // ---------- temporizador de cocina (sección 3) ----------
  const reloj = new THREE.Group(); reloj.position.set(2.2, 0, 1.25); reloj.rotation.y = -0.45; reloj.scale.setScalar(0.001); cocina.add(reloj);
  const RC = 0.82, YC = 0.98;
  const caja = new THREE.Mesh(new THREE.CylinderGeometry(RC + 0.08, RC + 0.1, 0.34, S).rotateX(Math.PI / 2), mat.plastico(0xff4d5e, 0.35)); caja.position.y = YC; reloj.add(caja);
  const pata = new THREE.Mesh(geo.caja(0.9, 0.12, 0.36, 0.05), mat.plastico(0xd63c4b, 0.4)); pata.position.y = 0.08; reloj.add(pata);
  const esfera = new THREE.Mesh(new THREE.CircleGeometry(RC, S), mat.pintado((g, w, h) => {
    g.fillStyle = '#fbf8f1'; g.beginPath(); g.arc(w / 2, h / 2, w / 2, 0, 7); g.fill();
    const c = w / 2; g.strokeStyle = '#2a2d35'; g.fillStyle = '#2a2d35'; g.textAlign = 'center'; g.font = `800 ${w * 0.085}px "Inter"`;
    for (let m = 0; m < 60; m++) { const a = (m / 60) * 6.283 - Math.PI / 2, l = m % 5 === 0 ? 0.08 : 0.04; g.lineWidth = m % 5 === 0 ? 6 : 3;
      g.beginPath(); g.moveTo(c + Math.cos(a) * c * 0.94, c + Math.sin(a) * c * 0.94); g.lineTo(c + Math.cos(a) * c * (0.94 - l), c + Math.sin(a) * c * (0.94 - l)); g.stroke();
      if (m % 10 === 0) g.fillText(String(m), c + Math.cos(a) * c * 0.72, c + Math.sin(a) * c * 0.72 + w * 0.03); }
  }, { w: 512, h: 512, rugosidad: 0.4 })); esfera.position.set(0, YC, 0.175); reloj.add(esfera);
  // cuñas de tiempo (1 hora en gris, 20 minutos en amarillo): círculo que se revela en sentido horario
  const cuna = (color, z) => {
    const g = new THREE.CircleGeometry(RC * 0.6, 120, Math.PI / 2, Math.PI * 2);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
    m.scale.x = -1; m.position.set(0, YC, z); m.userData.sinSombra = true; reloj.add(m); g.setDrawRange(0, 0); return { m, g, k: { v: 0 } };
  };
  const cunaHora = cuna('#8a93a6', 0.18), cunaVeinte = cuna(AMARILLO, 0.185);
  cada(() => [cunaHora, cunaVeinte].forEach(c => c.g.setDrawRange(0, Math.round(120 * c.k.v) * 3)));
  const manecilla = new THREE.Mesh(geo.caja(0.05, RC * 0.66, 0.03, 0.012).translate(0, RC * 0.28, 0), mat.plano('#20232a')); manecilla.position.set(0, YC, 0.2); reloj.add(manecilla);
  const eje = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.06, 24).rotateX(Math.PI / 2), mat.plano('#20232a')); eje.position.set(0, YC, 0.21); reloj.add(eje);
  cada(() => { manecilla.rotation.z = -Math.max(cunaHora.k.v * (cunaVeinte.k.v > 0 ? 0 : 1), cunaVeinte.k.v / 3) * 6.283; });

  // ---------- cima del Everest (sección 2) ----------
  const monte = new THREE.Group(); escena.add(monte);
  const montana = (escala, semilla) => {
    // el perfil va de abajo arriba (así las caras miran hacia fuera)
    const g = new THREE.LatheGeometry([[18, -16], [13, -11.5], [9, -7.5], [5.5, -3.6], [3, -1.1], [1.5, 0], [0, 0.15]].map(([r, y]) => new THREE.Vector2(r * escala, y * escala)), 9).toNonIndexed();
    const pos = g.attributes.position, col = [], r = azar(semilla), cache = new Map();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), k = `${x.toFixed(2)},${y.toFixed(2)},${z.toFixed(2)}`;
      if (!cache.has(k)) cache.set(k, Math.abs(x) + Math.abs(z) < 0.01 ? [0, 0, 0] : [(r() - 0.5) * 1.1 * escala, (r() - 0.5) * 0.8 * escala, (r() - 0.5) * 1.1 * escala]);
      const [dx, dy, dz] = cache.get(k); pos.setXYZ(i, x + dx * Math.min(1, -y / 2), y + dy * Math.min(1, -y / 2), z + dz * Math.min(1, -y / 2));
    }
    for (let i = 0; i < pos.count; i += 3) {   // cada cara: nieve arriba, roca abajo
      const y = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3, ruido = Math.sin(i * 1.7) * Math.cos(i * 0.61);
      const nieve = y > -5.5 * escala + ruido * 3.2 * escala && !(y < -0.6 * escala && ruido > 0.55);   // nieve con rocas que asoman
      // nieve en sombra azulada (no lava el plano) y roca
      const c = new THREE.Color(nieve ? (ruido > 0 ? '#c8d5e6' : '#b2c2d8') : '#46526a'); for (let j = 0; j < 3; j++) col.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
    // sin sombra propia (en una malla tan grande el mapa de sombras la ennegrece); la principal sí recibe la del alpinista
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })); m.userData.sinSombra = true; return m;
  };
  const cima = montana(1, 21); cima.receiveShadow = true; monte.add(cima);
  [[-34, -12, -70, 1.3, 3], [40, -16, -90, 1.6, 7], [-70, -20, -40, 1.2, 11], [70, -14, -30, 1.1, 17]].forEach(([x, y, z, e, s]) => { const m = montana(e, s); m.position.set(x, y, z); monte.add(m); });
  // mar de nubes
  { const N = 46, r = azar(31), nubes = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 16, 10), mat.plano('#ffffff'), N), m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    for (let i = 0; i < N; i++) { const a = r() * 6.283, d = 18 + r() * 80; nubes.setMatrixAt(i, m4.compose(new THREE.Vector3(Math.cos(a) * d, -13 - r() * 3, Math.sin(a) * d - 20), q, new THREE.Vector3(6 + r() * 8, 1.4 + r(), 4 + r() * 5))); }
    nubes.userData.sinSombra = true; nubes.frustumCulled = false; monte.add(nubes); }
  // banderas de oración
  { const colores = ['#3f6fd8', '#ffffff', '#ff4d5e', '#3ddc84', AMARILLO], a = new THREE.Vector3(-1.3, 1.5, -0.9), b = new THREE.Vector3(1.9, 0.1, -1.6);
    const mastil = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.6, 10), mat.plano('#6b4a2e')); mastil.position.set(a.x, 0.75, a.z); monte.add(mastil);
    for (let i = 0; i < 9; i++) { const k = (i + 0.5) / 9, p = a.clone().lerp(b, k); p.y -= Math.sin(k * Math.PI) * 0.35;
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.26), mat.plano(colores[i % 5], { emisivo: 0.05 })); fl.material.side = THREE.DoubleSide; fl.position.copy(p); fl.position.y -= 0.14; fl.rotation.y = -0.2; monte.add(fl); } }
  // alpinista con un hornillo y un cazo pequeño en corte
  const alpinista = persona({ ropa: '#ff4d5e', pantalon: '#26304a', piel: '#d9a37a', pelo: '#1d2742', poses: [[0, 'quieto']] });
  alpinista.position.set(-0.45, 0.1, -0.15); alpinista.rotation.y = 0.55; monte.add(alpinista);
  const hornillo = new THREE.Group(); hornillo.position.set(0.55, 0.08, 0.3); monte.add(hornillo);
  hornillo.add(new THREE.Mesh(geo.torno([[0, 0], [0.16, 0], [0.17, 0.2], [0.12, 0.26], [0, 0.27]], 32), mat.plastico(0x3a6df0, 0.35)));
  const llamita = halo(hornillo, { color: '#5aa0ff', tam: 0.35, opacidad: 0.8 }); llamita.position.y = 0.3;
  const cacito = new THREE.Group(); cacito.position.y = 0.3; hornillo.add(cacito);
  const PERFIL_CACITO = PERFIL_CAZO.map(([r, y]) => [r * 0.42, y * 0.42]);
  cacito.add(new THREE.Mesh(medio(PERFIL_CACITO, false, 32), acero()));
  const aguaCacito = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.39, 0.3, 32), aguaMat()); aguaCacito.position.y = 0.18;
  const fondoCacito = new THREE.Mesh(new THREE.CylinderGeometry(0.41, 0.41, 0.03, 32), acero(0xaeb5be)); fondoCacito.position.y = 0.015; cacito.add(fondoCacito); cacito.add(aguaCacito);
  const hervorCacito = burbujas(cacito, { radio: 0.39, y0: 0.04, alto: 0.29, n: 30, tam: 0.03, semilla: 3, vel: 1.4 });
  const vaporCacito = vapor(cacito, { pos: [0, 0.42, 0], n: 3, alto: 0.9, tam: 0.45 });
  const bloquesEv = [0, 1].map(i => {
    const b = new THREE.Mesh(geo.caja(0.85, 0.22, 0.85, 0.04), new THREE.MeshStandardMaterial({ color: '#a9dcff', roughness: 0.3, transparent: true, opacity: 0.32, depthWrite: false }));
    b.userData.sinSombra = true; bordes(b, { color: '#d6f0ff', opacidad: 0.7 }); b.position.set(0, 0.62 + i * 0.25, 0); cacito.add(b); return b;
  });

  // visibilidad por sección (lo que no sale en cuadro no se pinta)
  cada(T => {
    const s = seccion(T);
    cocina.visible = s !== 1; monte.visible = s === 1;
    cazo.visible = s === 0; olla.visible = s === 2;
    cazoDelante.visible = metalDelante.opacity > 0.01;
    ollaDelante.visible = tapaDelante.visible = aceroDelante.opacity > 0.01;
  });

  // ---------- coreografía ----------
  // 0. El cazo hierve; el termómetro marca 100.
  hervorCazo.hervor = 1; vaporCazo.fuerza = 1;
  ui.cifra({ texto: t => `${Math.round(temp.v)} °C`, tam: 120, t: palabra(0, '100'), hasta: fin(0), y: 1320 });
  // 1. «Pues no»: sello y caen los primeros bloques de aire.
  ui.sello('NO SIEMPRE', { y: 1330, color: '#ff4d5e', t: palabra(1, 'no'), hasta: fin(1) });
  [0, 1, 2].forEach(i => cae(bloques[i], palabra(1, 'depende') + i * 0.14, i));
  ui.etiqueta('aire', { ancla: [0.9, 2.3, 0.9], color: '#a9dcff', t: palabra(1, 'aire'), hasta: fin(1), linea: false });
  // 2. Corte del cazo: burbujas de vapor
  tween(metalDelante, { opacity: 0 }, { t: f(2) - 0.1, dur: 0.6, ease: 'inOut' });
  ui.etiqueta('burbujas de vapor', { ancla: [0.25, 0.75, 0.5], offset: [0.3, 0.25, 0.4], color: '#ffffff', t: palabra(2, 'burbujas'), hasta: fin(2) });
  // 3. Más aire encima: cuesta más hervir (las burbujas se apagan)
  [3, 4].forEach((i, j) => cae(bloques[i], palabra(3, 'aplasta') + j * 0.16, i));
  ui.flecha({ desde: { ancla: [-1.2, 4.2, 0.9] }, hacia: { ancla: [-1.2, 1.3, 0.9] }, color: '#a9dcff', grosor: 8, t: palabra(3, 'aplasta'), hasta: fin(3) });
  tween(hervorCazo, { hervor: 0.12 }, { t: palabra(3, 'cuanto'), dur: fin(3) - palabra(3, 'cuanto') - 0.2, ease: 'inOut' });
  // 4-5. Everest: poco aire, hierve a 70
  hervorCacito.hervor = 1; vaporCacito.fuerza = 1;
  sonido('whoosh', f(4), { dur: 1.0 });
  ui.etiqueta('Everest · 8.849 m', { x: 540, y: 1180, color: '#ffffff', t: palabra(4, 'everest'), hasta: palabra(4, '70') - 0.1, quieto: true });
  ui.cifra({ texto: '70 °C', tam: 120, t: palabra(4, '70'), hasta: fin(5), y: 1300 });
  ui.etiqueta('poco aire', { ancla: [0.55, 1.05, 0.3], offset: [0.5, -0.1, 0], color: '#a9dcff', t: palabra(4, 'poco'), hasta: fin(4) });
  ui.etiqueta('mucho más tiempo', { ancla: [0.55, 0.5, 0.3], offset: [-0.6, 0.55, 0.2], color: AMARILLO, t: palabra(5, 'muchísimo'), hasta: fin(5) });
  // 6. La olla exprés: tapa en el aire
  sonido('whoosh', f(6), { dur: 1.0 });
  const abierta = { y: 1.15, inc: 0.32, giro: 0.7 };
  cada(() => { tapa.position.y = 1.32 + abierta.y; tapa.rotation.set(0, abierta.giro, abierta.inc); });
  // 7. Cierra herméticamente: baja (pesado) y gira hasta encajar (clic)
  tween(abierta, { y: 0, inc: 0 }, { t: palabra(7, 'cierra') - 0.1, dur: 0.8, ease: 'pesado' });
  tween(abierta, { giro: 0.08 }, { t: palabra(7, 'cierra') - 0.1, dur: 0.8, ease: 'pesado' });
  tween(abierta, { giro: 0 }, { t: palabra(7, 'herméticamente'), dur: 0.3, ease: 'rapido' });
  sonido('clic', palabra(7, 'herméticamente') + 0.15);
  fx.temblor({ t: palabra(7, 'herméticamente') + 0.15, dur: 0.15, fuerza: 0.01 });
  ui.etiqueta('cierre hermético', { ancla: [-1.2, 1.36, 0.3], offset: [-0.2, -0.35, 0.4], color: AMARILLO, t: palabra(7, 'herméticamente') + 0.2, hasta: fin(7) });
  tween(hervorOlla, { hervor: 0.25 }, { t: f(6), dur: 0.5, ease: 'sale' });
  // 8. Corte de la olla: el vapor atrapado sube la presión a 2 atmósferas
  tween(aceroDelante, { opacity: 0 }, { t: f(8) - 0.1, dur: 0.6, ease: 'inOut' });
  tween(presion, { vapor: 1 }, { t: f(8) - 0.1, dur: 0.9, ease: 'inOut' });
  tween(presion, { v: 2 }, { t: f(8) + 0.4, dur: palabra(8, '2') - f(8) + 0.2, ease: 'inOut' });
  tween(hervorOlla, { hervor: 0 }, { t: f(8) + 0.2, dur: 0.8, ease: 'inOut' });
  ui.cifra({ texto: '2', unidad: 'atmósferas', tam: 120, t: palabra(8, '2'), hasta: fin(8), y: 1320 });
  ui.etiqueta('vapor atrapado', { ancla: [0.3, 1.22, 0.5], offset: [0.5, 0.3, 0.3], color: '#ffffff', t: palabra(8, 'vapor'), hasta: fin(8) });
  // 9. El agua no hierve hasta 120: el termómetro sube y vuelven las burbujas
  tween(temp, { v: 120 }, { t: f(9) + 0.3, dur: palabra(9, '120') - f(9), ease: 'inOut' });
  tween(hervorOlla, { hervor: 1 }, { t: palabra(9, '120'), dur: 0.5, ease: 'sale' });
  ui.cifra({ texto: t => `${Math.round(temp.v)} °C`, tam: 120, t: palabra(9, 'hierve'), hasta: fin(9), y: 1320 });
  // 10. +20 grados: parece poca cosa
  ui.flecha({ desde: { ancla: [-1.98, 0.12 + yT(100) - 0.12, -0.6] }, hacia: { ancla: [-1.98, yT(120) - 0.02, -0.6] }, color: AMARILLO, grosor: 8, t: palabra(10, '20'), hasta: fin(10) });
  ui.etiqueta('+20 °C', { ancla: [-1.98, yT(110), -0.6], offset: [-0.45, 0, 0], color: AMARILLO, t: palabra(10, '20') + 0.15, hasta: fin(10), linea: false });
  tween(aceroDelante, { opacity: 1 }, { t: f(10), dur: 0.6, ease: 'inOut' });
  tween(presion, { vapor: 0 }, { t: f(10), dur: 0.4, ease: 'inOut' });
  // 11. Hasta 3 veces más rápido: entra el temporizador
  tween(reloj.scale, { x: 1, y: 1, z: 1 }, { t: f(11) - 0.3, dur: 0.7, ease: 'muelle' });
  tween(reloj.scale, { x: 0.001, y: 0.001, z: 0.001 }, { t: fin(12) + 0.2, dur: 0.35, ease: 'entra' });
  ui.cifra({ texto: '×3', unidad: 'más rápido', tam: 130, t: palabra(11, '3'), hasta: fin(11), y: 1320 });
  // 12. Una hora → 20 minutos
  tween(cunaHora.k, { v: 1 }, { t: palabra(12, 'hora') - 0.2, dur: 0.9, ease: 'inOut' });
  tween(cunaVeinte.k, { v: 1 / 3 }, { t: palabra(12, '20') - 0.1, dur: 0.7, ease: 'inOut' });
  const marca = (x, y) => { const o = new THREE.Object3D(); o.position.set(x, y, 0.2); reloj.add(o); return o; };
  ui.etiqueta('1 hora', { ancla: marca(-0.55, YC - 0.35), offset: [-0.35, -0.25, 0], color: '#c9cfdb', t: palabra(12, 'hora'), hasta: fin(12) });
  ui.etiqueta('20 min', { ancla: marca(0.35, YC + 0.2), offset: [0.45, 0.15, 0], color: AMARILLO, t: palabra(12, '20') + 0.3, hasta: fin(12) });
  // 13. La válvula suelta el vapor que sobra
  tween(vaporValvula, { fuerza: 1 }, { t: palabra(13, 'suelta') - 0.1, dur: 0.3, ease: 'sale' });
  tween(vaporValvula, { fuerza: 0.45 }, { t: fin(13), dur: 0.8, ease: 'inOut' });
  sonido('whoosh', palabra(13, 'suelta'), { vol: 0.6, dur: 1.2 });
  // la aguja se mete en el rojo con la pregunta y vuelve a 2 cuando la válvula suelta vapor
  tween(presion, { v: 2.65 }, { t: palabra(13, 'sube') - 0.1, dur: 0.6, ease: 'inOut' });
  tween(presion, { v: 2 }, { t: palabra(13, 'suelta') + 0.2, dur: 0.7, ease: 'inOut' });
  cada(T => { const w = vaporValvula.fuerza; peso.rotation.set(Math.sin(T * 31) * 0.12 * w, 0, Math.cos(T * 27) * 0.12 * w); });
  ui.etiqueta('válvula', { ancla: VALVULA, offset: [0.45, 0.15, 0.3], color: AMARILLO, t: palabra(13, 'válvula'), hasta: fin(13) });
  // 14. Remate: 120 °C
  ui.cifra({ texto: '120 °C', tam: 140, t: palabra(14, '120') - 0.1, hasta: fin(14), y: 1300 });
  // 15. Compartir
  ui.compartir({ previa: '¿Por qué la olla exprés cocina tan rápido? 🍲', nombres: ['Mamá', 'Tía Pili', 'Abuelo'], caras: ['👩🏻', '👵🏻', '👴🏻'], t: palabra(15, 'seguro') - 0.3, hasta: fin(15) + 1 });

  // ---------- director de cámara: un encuadre por frase, fundido de 1,1 s; corte en el cambio de sección ----------
  const P = (pos, mira, fov = 40) => ({ pos, mira, fov });
  const planos = [
    P([1.3, 2.7, 7.0], [-0.35, 1.25, -0.3], 40),        // 0 cazo hirviendo y termómetro
    P([0.9, 3.0, 7.6], [0, 2.2, 0], 42),                // 1 caen los bloques de aire
    P([1.0, 1.7, 5.4], [0, 0.6, 0], 38),                // 2 corte: burbujas
    P([1.1, 3.2, 8.4], [-0.1, 2.1, 0], 42),             // 3 más aire: cuesta más
    P([6.5, 3.4, 11.5], [0, 0.5, 0], 40),               // 4 Everest
    P([2.3, 1.3, 3.6], [0.15, 0.75, 0.1], 40),          // 5 el cacito a 70 °C
    P([1.8, 2.6, 7.2], [0.1, 1.5, 0], 38),              // 6 la olla exprés
    P([1.3, 2.4, 5.4], [0, 1.4, 0], 38),                // 7 cierra
    P([0.8, 1.9, 4.4], [0, 1.0, 0], 40),                // 8 corte: vapor atrapado
    P([0.2, 2.3, 6.6], [-0.8, 1.5, -0.4], 40),          // 9 el termómetro sube a 120
    P([-0.7, 2.5, 2.7], [-1.6, 2.3, -0.9], 36),         // 10 +20 °C
    P([3.4, 1.6, 5.0], [2.15, 1.0, 1.25], 38),          // 11 el temporizador
    P([3.25, 1.35, 4.5], [2.15, 1.0, 1.25], 36),        // 12 una hora → 20 minutos
    P([0.7, 2.75, 3.0], [-0.25, 2.05, 0.15], 38),         // 13 la válvula
    P([1.5, 2.9, 7.6], [-0.3, 1.45, -0.2], 40),         // 14 remate
    P([2.4, 2.7, 8.6], [-0.2, 1.4, -0.2], 40),          // 15 compartir
  ];
  const CORTES = new Set([4, 6]);
  // Cada plano se acerca despacio (3 % por segundo, hasta un 12 %); el del Everest baja a la cima mucho más (hasta un 45 %).
  const pose = (i, T) => {
    const p = planos[i], ritmo = i === 4 ? 0.2 : 0.03, tope = i === 4 ? 0.45 : 0.12;
    const e = 1 - Math.min(tope, Math.max(0, T - f(i)) * ritmo);
    return { ...p, pos: p.pos.map((v, j) => p.mira[j] + (v - p.mira[j]) * e) };
  };
  const fraseEn = T => { let i = 0; while (i + 1 < frases.length && T >= frases[i + 1].inicio) i++; return i; };
  const suave = p => p * p * (3 - 2 * p), mezcla = (a, b, k) => a.map((v, j) => v + (b[j] - v) * k);
  cada(T => {
    const i = fraseEn(T), a = pose(i, T), k = CORTES.has(i) ? 1 : suave(Math.min(1, (T - f(i)) / 1.1));
    const b = i === 0 || k >= 1 ? a : pose(i - 1, f(i));
    camara.poner({ pos: mezcla(b.pos, a.pos, k), mira: mezcla(b.mira, a.mira, k), fov: b.fov + (a.fov - b.fov) * k });
  });
  cada(T => sombras(seccion(T) === 1 ? { centro: [0, 0, 0], tam: 5 } : { centro: [0, 1, -0.3], tam: 6 }));
  camara.deriva(0.5);
  tween(dof, { apertura: 1.2 }, { t: f(15), dur: 0.8, ease: 'inOut' });
}
