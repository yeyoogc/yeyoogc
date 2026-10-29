// ¿Cómo puede un tren alcanzar a otro en una línea de alta velocidad? (accidente de Urda, Toledo, 28-10-2026)
// Tono sobrio: explicación del bloqueo y del LZB y de lo que ha contado el ministro. Nunca se ve el choque.
// Escala: 1 unidad = 4 m. La vía va a lo largo de z; los trenes avanzan hacia -z.
export default function crear(ctx) {
  const { THREE, escena, f, fin, palabra, tween, cada, mat, geo, ui, camara, mundo, repetir, dof, azar, frases, sombras } = ctx;
  // Primera hora de la mañana de otoño (el choque fue sobre las 8:54): sol bajo y cálido, cielo apagado.
  mundo('dia', { suelo: false, cielo: ['#4f6f9e', '#86a0bf', '#cbbfa8', '#d8cdb8'], sol: { dir: [1, 0.22, 0.35], color: '#fff0d4', tam: 0.8 },
    niebla: ['#d8cdb8', 40, 185], luz: { color: '#ffe2bd', fuerza: 2.3, dir: [1, 0.5, 0.3] }, hemi: ['#c3d0e0', '#6b5a3e', 0.95] });
  dof.apertura = 0.12; dof.resplandor = 0.3; dof.exposicion = 0.86;
  const r = azar(11);

  // ---------- llanura manchega: parcelas y olivos ----------
  const base = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), mat.plano('#b8955c')); base.rotation.x = -Math.PI / 2; base.position.set(0, -0.02, -100); base.receiveShadow = true; base.userData.sinSombra = true; escena.add(base);
  const tonos = ['#ad8b55', '#bfa06c', '#98914f', '#a8824d', '#c2a676'];
  for (let i = 0; i < 40; i++) {
    const lado = i % 2 ? 1 : -1, w = 18 + r() * 40, d = 30 + r() * 70;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat.plano(tonos[i % tonos.length]));
    p.rotation.x = -Math.PI / 2; p.position.set(lado * (6 + w / 2 + r() * 50), -0.015 + i * 0.0002, 60 - r() * 340); p.receiveShadow = true; p.userData.sinSombra = true; escena.add(p);
  }
  const copa = new THREE.IcosahedronGeometry(0.42, 1).translate(0, 0.62, 0), tronco = new THREE.CylinderGeometry(0.05, 0.07, 0.4, 6).translate(0, 0.2, 0);
  for (const x of [-16, 16]) {
    const o = { filas: 170, columnas: 9, paso: [2.4, 2.6], centro: [x, 0, -85], azar: 0.35, escala: [0.8, 1.2], semilla: x > 0 ? 3 : 4 };
    repetir({ geometria: copa, material: mat.plano('#7d8a52'), ...o });
    repetir({ geometria: tronco, material: mat.plano('#5a4632'), ...o });
  }

  // ---------- vía doble: balasto, carriles, traviesas, catenaria ----------
  const Z0 = -85, L = 440, VIA = { A: -0.7, B: 0.7 };
  const balasto = new THREE.Mesh(geo.caja(3, 0.14, L, 0.05), mat.plano('#8e877c')); balasto.position.set(0, 0.07, Z0); escena.add(balasto);
  for (const xv of [VIA.A, VIA.B]) {
    for (const dx of [-0.18, 0.18]) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, L), mat.metalPulido(0xcfd3da, 0.25)); c.position.set(xv + dx, 0.19, Z0); escena.add(c); }
    repetir({ geometria: new THREE.BoxGeometry(0.6, 0.03, 0.07), material: mat.plano('#6e655b'), filas: 730, columnas: 1, paso: [1, 0.6], centro: [xv, 0.155, Z0], azar: 0, escala: [1, 1], girar: false });
  }
  repetir({ geometria: new THREE.CylinderGeometry(0.035, 0.045, 2, 8).translate(0, 1, 0), material: mat.plano('#9aa0a8'), filas: 29, columnas: 2, paso: [3.8, 15], centro: [0, 0, Z0], azar: 0, escala: [1, 1], girar: false });
  for (const xv of [VIA.A, VIA.B]) { const h = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.006, L), mat.plano('#6a707a')); h.position.set(xv, 1.62, Z0); h.userData.sinSombra = true; escena.add(h); }

  // ---------- cable LZB entre los carriles de la vía A: pulsos de datos que viajan; se apaga cuando cae ----------
  const cableMat = new THREE.ShaderMaterial({
    uniforms: { T: { value: 0 }, vivo: { value: 0.25 } },
    vertexShader: 'varying float vZ; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vZ = w.z; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float T, vivo; varying float vZ;
      void main(){
        float p = fract(vZ * 0.07 + T * 0.8), pulso = smoothstep(0.82, 1.0, p);
        vec3 c = vec3(0.15, 0.85, 0.9) * (0.35 + 2.4 * pulso) * vivo + vec3(0.03, 0.035, 0.04) * (1.0 - vivo);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const cable = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.012, L), cableMat); cable.position.set(VIA.A, 0.17, Z0); cable.userData.sinSombra = true; escena.add(cable);
  cada(T => { cableMat.uniforms.T.value = T; });

  // ---------- tramos de bloqueo (franjas junto a la vía A) y señales ----------
  const TRAMOS = [[50, 0, '#3ddc84'], [0, -50, '#3ddc84'], [-50, -100, '#ffd23f'], [-100, -150, '#ff4d5e'], [-150, -200, '#3ddc84']];
  const franjas = TRAMOS.map(([a, b, color]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.32, Math.abs(a - b) - 1.2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(VIA.A - 1.15, 0.16, (a + b) / 2); m.userData.sinSombra = true; escena.add(m); return m;
  });
  const senal = (z, color) => {
    const g = new THREE.Group(); g.position.set(VIA.A - 1.15, 0, z); escena.add(g);
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.25, 8).translate(0, 0.62, 0), mat.plano('#33363c')));
    const cab = new THREE.Mesh(geo.caja(0.2, 0.42, 0.12, 0.04), mat.plano('#1c1e22')); cab.position.y = 1.3; g.add(cab);
    const luz = new THREE.Mesh(new THREE.CircleGeometry(0.065, 24), mat.emisivo(color, 3)); luz.position.set(0, 1.36, 0.062); g.add(luz);
    return g;
  };
  senal(0, '#3ddc84'); senal(-50, '#ffd23f'); const roja = senal(-100, '#ff3b3b'); senal(-150, '#3ddc84');

  // ---------- trenes ----------
  function tren({ coches = 4, color, franja, x, z }) {
    const g = new THREE.Group(), cuerpo = mat.plastico(color, 0.32), oscuro = mat.plastico(0x161a22, 0.15), linea = mat.plano(franja), gris = mat.plano('#2a2d33');
    for (let i = 0; i < coches; i++) {
      const c = new THREE.Group(); c.position.z = i * 5.15; g.add(c);
      const caja = new THREE.Mesh(geo.caja(0.72, 0.82, 5, 0.2), cuerpo); caja.position.y = 0.66; c.add(caja);
      const ventanas = new THREE.Mesh(geo.caja(0.735, 0.17, 4.4, 0.06), oscuro); ventanas.position.y = 0.82; c.add(ventanas);
      const fr = new THREE.Mesh(geo.caja(0.737, 0.05, 4.8, 0.02), linea); fr.position.y = 0.6; c.add(fr);
      for (const zb of [-1.8, 1.8]) { const b = new THREE.Mesh(geo.caja(0.5, 0.14, 0.9, 0.03), gris); b.position.set(0, 0.28, zb); c.add(b); }
      if (i < coches - 1) { const fu = new THREE.Mesh(geo.caja(0.6, 0.66, 0.3, 0.05), gris); fu.position.set(0, 0.66, 2.6); c.add(fu); }
    }
    const morro = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(-Math.PI / 2).scale(0.36, 0.41, 2.2), cuerpo);
    morro.position.set(0, 0.66, -2.45); g.add(morro);
    const cristal = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16, Math.PI * 0.25, Math.PI * 0.5, Math.PI * 0.22, Math.PI * 0.22).rotateX(-Math.PI / 2).scale(0.365, 0.415, 2.21), oscuro);
    cristal.position.copy(morro.position); g.add(cristal);
    for (const lx of [-0.17, 0.17]) { const luz = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), mat.emisivo('#fff6d0', 3)); luz.position.set(lx, 0.52, -4.25); g.add(luz); }
    const techo = new THREE.Object3D(); techo.position.set(0, 1.25, 7); g.add(techo);
    const punta = new THREE.Object3D(); punta.position.set(0, 0.66, -4.7); g.add(punta);
    g.position.set(x, 0, z); escena.add(g);
    return { g, techo, punta };
  }
  const ave = tren({ color: '#f4f5f7', franja: '#6d2a8a', x: VIA.A, z: 100 });
  const iryo = tren({ color: '#b3122e', franja: '#f2f2f2', x: VIA.A, z: -145 });
  const otro = tren({ color: '#eef0f3', franja: '#e8792e', x: VIA.B, z: -40 });

  // Recorrido del AVE (z del grupo): corre, frena solo antes del tramo rojo, se queda parado ante la señal y reanuda despacio.
  // Nunca llega al Iryo: el último plano con trenes los deja separados.
  const PARADA = -100 + 2 + 4.7;   // el morro queda 2 unidades antes de la señal
  const aveZ = { z: 100 };
  tween(aveZ, { z: 40 }, { t: 0, dur: f(3), ease: 'lineal' });
  tween(aveZ, { z: -30 }, { t: f(3), dur: f(6) - f(3), ease: 'lineal' });
  tween(aveZ, { z: PARADA }, { t: f(6), dur: fin(6) - f(6) + 0.6, ease: 'sale' });
  tween(aveZ, { z: PARADA - 9 }, { t: f(9) + 0.4, dur: fin(10) - f(9) - 0.4, ease: 'entra' });
  const otroZ = { z: -40 };
  tween(otroZ, { z: -52 }, { t: f(10), dur: fin(10) - f(10), ease: 'inOut' });
  cada(T => {
    ave.g.position.z = aveZ.z; otro.g.position.z = otroZ.z;
    const trenes = T < f(11);
    ave.g.visible = iryo.g.visible = trenes; otro.g.visible = T >= f(10) - 0.3 && trenes;
  });

  // ---------- anotaciones ----------
  // 1. Dónde y qué
  ui.etiqueta('Iryo · parado', { ancla: iryo.techo, offset: [0, 0.4, 0], color: '#ff4d5e', t: palabra(1, 'Iryo'), hasta: fin(1) });
  ui.tarjeta({ titulo: 'Miércoles 28 de octubre', valor: 'cerca de Urda (Toledo)', acento: '#ff4d5e', t: palabra(1, 'Urda'), hasta: fin(1), y: 1330 });
  // 2. Las víctimas: el plano se apaga, sin gráficos
  tween(dof, { exposicion: 0.55 }, { t: f(2), dur: 1.2, ease: 'inOut' });
  tween(dof, { exposicion: 0.86 }, { t: f(3), dur: 0.8, ease: 'inOut' });
  // 3. Frenar desde 300: más de 3 km
  ui.flecha({ desde: { ancla: ave.punta }, hacia: { ancla: [VIA.A, 0.5, -130] }, color: '#ffffff', grosor: 7, t: palabra(3, 'kilómetros') - 0.3, hasta: fin(3) });
  ui.etiqueta('más de 3 km para parar', { ancla: [VIA.A, 1.6, -60], color: '#ffffff', t: palabra(3, 'kilómetros'), hasta: fin(3), linea: false });
  // 4. Tramos: las franjas se encienden escalonadas
  franjas.forEach((m, i) => tween(m.material, { opacity: 0.85 }, { t: palabra(4, 'tramos') + i * 0.12, dur: 0.4, ease: 'sale' }));
  ui.etiqueta('libre', { ancla: [VIA.A - 1.15, 0.3, -25], color: '#3ddc84', t: palabra(4, 'solo') - 0.2, hasta: fin(4) });
  ui.etiqueta('ocupado', { ancla: [VIA.A - 1.15, 0.3, -125], color: '#ff4d5e', t: palabra(4, 'solo'), hasta: fin(4) });
  // 5. El cable LZB
  tween(cableMat.uniforms.vivo, { value: 1 }, { t: palabra(5, 'LZB') - 0.3, dur: 0.6, ease: 'sale' });
  ui.etiqueta('cable LZB', { ancla: { getWorldPosition: v => v.set(VIA.A, 0.17, aveZ.z - 12) }, offset: [0.6, 0.35, 0], color: '#2ee6f0', t: palabra(5, 'cable'), hasta: fin(5) });
  // 6. Frena solo
  const dur6 = fin(6) - f(6) + 0.6;
  ui.cifra({ texto: t => `${Math.round(300 * Math.pow(1 - Math.min(1, Math.max(0, (t - f(6)) / dur6)), 2))}`, unidad: 'km/h', tam: 110, t: f(6) + 0.1, hasta: fin(6), y: 1300 });
  // 7. Cae el LZB
  tween(cableMat.uniforms.vivo, { value: 0 }, { t: palabra(7, 'cayó') - 0.05, dur: 0.25, ease: 'entra' });
  ui.cifra({ texto: '8:30', unidad: 'LZB caído', tam: 110, t: palabra(7, '8:30'), hasta: fin(7), y: 1300 });
  // 8. Señal y centro de control
  ui.tarjeta({ titulo: 'Sin LZB', valor: 'solo sigue si autoriza el centro', acento: '#ffd23f', t: palabra(8, 'centro') - 0.4, hasta: fin(8), y: 1330 });
  // 9. La orden al AVE
  ui.tarjeta({ titulo: 'Orden al AVE', valor: 'marcha normal', acento: '#ff4d5e', t: palabra(9, 'normalidad') - 0.3, hasta: fin(9), y: 1330 });
  ui.etiqueta('Iryo · parado', { ancla: iryo.techo, offset: [0, 0.4, 0], color: '#ff4d5e', t: palabra(9, 'Iryo'), hasta: fin(9) });
  ui.etiqueta('AVE', { ancla: ave.techo, offset: [0, 0.4, 0], color: '#ffffff', t: f(9) + 0.3, hasta: fin(9) });
  // 10. Una orden se corrigió; la del AVE, no
  ui.tarjeta({ titulo: 'Otro tren', valor: 'orden corregida ✓', acento: '#3ddc84', t: palabra(10, 'cambiaron') - 0.3, hasta: fin(10), y: 1180 });
  ui.tarjeta({ titulo: 'AVE', valor: 'sin corregir ✕', acento: '#ff4d5e', t: palabra(10, 'AVE') - 0.2, hasta: fin(10), y: 1350 });
  // 11-12. Investigación y recuerdo: la línea vacía, cada vez más oscura
  ui.tarjeta({ titulo: 'Investigación', valor: 'sigue abierta', acento: '#ffffff', t: palabra(11, 'investigación') - 0.2, hasta: fin(11), y: 1330 });
  tween(dof, { exposicion: 0.7 }, { t: f(11), dur: 1.5, ease: 'inOut' });
  tween(dof, { exposicion: 0.4 }, { t: f(12), dur: 2.5, ease: 'inOut' });
  tween(dof, { apertura: 0.5 }, { t: f(5), dur: 0.8, ease: 'inOut' }); tween(dof, { apertura: 0.12 }, { t: f(9), dur: 0.8, ease: 'inOut' });
  franjas.forEach(m => tween(m.material, { opacity: 0 }, { t: f(11), dur: 1.2, ease: 'inOut' }));
  tween(cableMat.uniforms.vivo, { value: 0.0 }, { t: f(11), dur: 0.01, ease: 'lineal' });

  // ---------- director de cámara: un encuadre por frase, fundido de 1,1 s entre uno y el siguiente ----------
  const ZA = () => aveZ.z;
  const planos = [
    T => ({ pos: [3.2, 4.2, ZA() + 17], mira: [VIA.A, 0.6, ZA() - 26], fov: 42 }),
    T => ({ pos: [5.5, 5, -112 + (T - f(1)) * 0.6], mira: [VIA.A, 0.8, -138], fov: 40 }),
    T => ({ pos: [7, 12 + (T - f(2)) * 1.2, -104], mira: [VIA.A, 0, -138], fov: 42 }),
    T => ({ pos: [1.1, 2.3, ZA() + 8], mira: [VIA.A, 0.9, ZA() - 30], fov: 46 }),
    T => ({ pos: [13, 34, 2], mira: [VIA.A, 0, -78], fov: 46 }),
    T => ({ pos: [-0.25, 0.42, ZA() - 13], mira: [VIA.A, 0.45, ZA() - 2], fov: 44 }),
    T => ({ pos: [6.5, 2.6, ZA() - 2], mira: [VIA.A, 0.7, ZA() - 13], fov: 42 }),
    T => ({ pos: [0.5, 0.65, -100.5], mira: [VIA.A, 0.25, -112], fov: 44 }),
    T => ({ pos: [-5.6, 0.9, -92.5], mira: [VIA.A - 0.6, 1.15, -99], fov: 44 }),
    T => ({ pos: [10, 22, -62], mira: [VIA.A, 0, -118], fov: 44 }),
    T => ({ pos: [14, 26, -44], mira: [0, 0, -110], fov: 46 }),
    T => ({ pos: [14 - (T - f(11)) * 0.6, 20, -30], mira: [0, 0, -120], fov: 46 }),
    T => ({ pos: [6, 12 + (T - f(12)) * 1.2, -70], mira: [VIA.A, 0, -140], fov: 46 }),
  ];
  const fraseEn = T => { let i = 0; while (i + 1 < frases.length && T >= frases[i + 1].inicio) i++; return i; };
  const suave = p => p * p * (3 - 2 * p), mezcla = (a, b, k) => a.map((v, j) => v + (b[j] - v) * k);
  cada(T => {
    const i = fraseEn(T), a = planos[i](T), k = suave(Math.min(1, (T - f(i)) / 1.1));
    const b = i === 0 || k >= 1 ? a : planos[i - 1](T), mira = mezcla(b.mira, a.mira, k);
    camara.poner({ pos: mezcla(b.pos, a.pos, k), mira, fov: b.fov + (a.fov - b.fov) * k });
    sombras({ centro: mira, tam: 22 });   // la sombra del sol cubre lo que se está mirando
  });
  camara.deriva(0.6);
}
