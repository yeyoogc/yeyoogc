// ¿Qué pasa si metes la marcha atrás a 120? Pomo de la palanca → caja de cambios por dentro (el piñón loco quieto
// intenta entrar contra el engranaje de salida a tope, choca y pierde un diente) → centralita de un automático.
export default function crear(ctx) {
  const { THREE, escena, f, palabra, tween, cada, mat, geo, ui, fx, color, camara, fondo, dof, bordes, halo, sombras } = ctx;
  const malla = (g, m, padre = escena) => { const o = new THREE.Mesh(g, m); padre.add(o); return o; };
  const cilindroZ = (r, largo, m, padre, seg = 48) => { const o = malla(new THREE.CylinderGeometry(r, r, largo, seg), m, padre); o.rotation.x = Math.PI / 2; return o; };

  // ================= 1. Consola y pomo =================
  const plasticoOscuro = mat.plastico(0x15161b, 0.55), cromo = mat.metalPulido(0xe3e7ee, 0.08);
  const consola = malla(geo.caja(3.2, 0.2, 3.2, 0.06), mat.plastico(0x1c1e24, 0.7)); consola.position.y = -1.0;
  const embellecedor = malla(new THREE.TorusGeometry(0.56, 0.035, 20, 96), cromo); embellecedor.rotation.x = Math.PI / 2; embellecedor.position.y = -0.89;
  malla(geo.torno(Array.from({ length: 30 }, (_, i) => { const y = i / 29; return [0.54 - 0.4 * Math.pow(y, 0.8) + 0.025 * Math.sin(y * 34), -0.9 + y * 0.82]; })), mat.goma(0x121317));

  const palanca = new THREE.Group(); palanca.position.y = -0.9; escena.add(palanca);
  malla(new THREE.CylinderGeometry(0.06, 0.07, 0.95, 32), cromo, palanca).position.y = 0.45;
  const pomo = new THREE.Group(); pomo.position.y = 0.88; palanca.add(pomo);
  malla(geo.torno([[0.13, 0], [0.15, 0.04], [0.3, 0.12], [0.46, 0.22], [0.52, 0.32], [0.52, 0.4], [0.49, 0.47], [0.44, 0.5], [0, 0.5]]), plasticoOscuro, pomo);
  malla(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 48), cromo, pomo).position.y = 0.02;
  const patron = mat.pintado((g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, w / 2); gr.addColorStop(0, '#202228'); gr.addColorStop(1, '#0c0d10');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(235,238,245,.85)'; g.lineWidth = 22; g.lineCap = 'round';
    g.beginPath(); for (const x of [300, 512, 724]) { g.moveTo(x, 340); g.lineTo(x, 684); } g.moveTo(300, 512); g.lineTo(724, 512); g.stroke();
    g.font = '800 150px Inter'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(235,238,245,.92)';
    [['1', 300, 230], ['3', 512, 230], ['5', 724, 230], ['2', 300, 800], ['4', 512, 800]].forEach(([n, x, y]) => g.fillText(n, x, y));
    g.fillStyle = '#ff4d5e'; g.fillText('R', 724, 800);
  }, { rugosidad: 0.35 });
  const tapa = malla(new THREE.CircleGeometry(0.43, 64), patron, pomo); tapa.rotation.x = -Math.PI / 2; tapa.position.y = 0.502;
  const marcaR = new THREE.Object3D(); marcaR.position.set(0.18, 0.51, 0.24); pomo.add(marcaR);

  // ================= 2. Caja de cambios (y = -8) =================
  const Y = -8, nA = 26, rA = 1.15, nB = 14, rB = 0.62, nC = 17, rC = 0.75, G = 0.34, ROTO = 13;
  const hA = (2.5 * rA) / nA, ang = (155 * Math.PI) / 180, angC = (215 * Math.PI) / 180;
  const pA = new THREE.Vector3(0.7, Y - 0.15, 0);
  const pB = pA.clone().add(new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0).multiplyScalar(rA + rB - hA));
  const pC = pB.clone().add(new THREE.Vector3(Math.cos(angC), Math.sin(angC), 0).multiplyScalar(rB + rC - hA));
  const contacto = [pA.x + Math.cos(ang) * (rA - hA * 0.5), pA.y + Math.sin(ang) * (rA - hA * 0.5), 0.2];

  const caja = new THREE.Group(); escena.add(caja);
  const acero = mat.metal(0xc6cbd3, 0.3), aceroOscuro = mat.metal(0x7d838d, 0.38), laton = mat.laton();
  // eje de salida con su engranaje de marcha atrás (A), dos marchas de avance y el anillo sincronizador de latón
  const salida = new THREE.Group(); salida.position.copy(pA); caja.add(salida);
  malla(geo.ejeEstriado(0.17, 4.2), aceroOscuro, salida);
  const A = malla(geo.engranaje(nA, rA, G, { aligerado: 5 }), acero.clone(), salida);
  malla(geo.engranaje(22, 0.95, 0.42, { aligerado: 4 }), acero, salida).position.z = -0.75;
  malla(geo.engranaje(30, 1.32, 0.42, { aligerado: 6 }), acero, salida).position.z = -1.45;
  malla(new THREE.TorusGeometry(0.42, 0.06, 20, 80), laton, salida).position.z = -0.38;
  cilindroZ(0.36, 0.2, acero, salida).position.z = -0.38;
  for (const z of [1.95, -2.0]) { cilindroZ(0.34, 0.22, aceroOscuro, salida).position.z = z; malla(new THREE.TorusGeometry(0.3, 0.05, 16, 64), acero, salida).position.z = z + 0.12; }
  // eje intermediario con su piñón de marcha atrás (C) y más ruedas detrás
  const intermedio = new THREE.Group(); intermedio.position.copy(pC); caja.add(intermedio);
  malla(geo.ejeEstriado(0.13, 4.0), aceroOscuro, intermedio);
  const C = malla(geo.engranaje(nC, rC, G, { agujero: 0.26 }), acero, intermedio);
  malla(geo.engranaje(16, 0.66, 0.42), acero, intermedio).position.z = -0.75;
  malla(geo.engranaje(12, 0.48, 0.42), acero, intermedio).position.z = -1.45;
  // piñón loco (B) en su ejecillo, desplazado: todavía no está engranado
  const B = new THREE.Group(); B.position.set(pB.x, pB.y, 1.15); caja.add(B);
  const aceroB = mat.metal(0xd6c9b0, 0.28);
  malla(geo.engranaje(nB, rB, G, { agujero: 0.3, sinDiente: ROTO }), aceroB, B);
  cilindroZ(0.1, 1.6, aceroOscuro, B);
  const matDiente = aceroB.clone(); matDiente.emissive.set(0xff2030); matDiente.emissiveIntensity = 0;
  const diente = malla(geo.diente(nB, rB, G, ROTO), matDiente, B);

  A.material.emissive.set(0xff6a00); A.material.emissiveIntensity = 0;
  cada(t => { salida.rotation.z = -2.1 * t; });

  // ================= 3. Centralita (x = 10) =================
  const X = 10, placa = new THREE.Group(); placa.position.set(X, Y, 0); placa.rotation.set(0.5, -0.35, 0); escena.add(placa);
  malla(geo.caja(3, 0.08, 2.3, 0.02), mat.pintado((g, w, h) => {
    g.fillStyle = '#0d3b2a'; g.fillRect(0, 0, w, h);
    const r = ctx.azar(4); g.strokeStyle = 'rgba(214,170,80,.55)'; g.lineWidth = 5;
    for (let i = 0; i < 60; i++) { let x = r() * w, y = r() * h; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 4; k++) { if (k % 2) x += (r() - 0.5) * 400; else y += (r() - 0.5) * 400; g.lineTo(x, y); } g.stroke(); }
    g.fillStyle = 'rgba(214,170,80,.8)'; for (let i = 0; i < 140; i++) { g.beginPath(); g.arc(r() * w, r() * h, 6, 0, 6.3); g.fill(); }
  }, { rugosidad: 0.45 }), placa);
  const chip = new THREE.Group(); chip.position.y = 0.1; placa.add(chip);
  malla(geo.caja(1.0, 0.12, 1.0, 0.02), mat.pintado((g, w, h) => {
    g.fillStyle = '#16181d'; g.fillRect(0, 0, w, h); g.fillStyle = '#d9dde6'; g.font = '800 220px "JetBrains Mono"'; g.textAlign = 'center'; g.fillText('TCU', w / 2, h / 2 + 70);
    g.fillStyle = '#7d8596'; g.font = '700 70px "JetBrains Mono"'; g.fillText('CAMBIO AUTO', w / 2, h / 2 + 190); g.beginPath(); g.arc(120, 120, 40, 0, 6.3); g.fill();
  }, { rugosidad: 0.5 }), chip);
  const oro = mat.oro();
  for (let i = 0; i < 12; i++) for (const [x, z, ry] of [[-0.55, -0.44 + i * 0.08, 0], [0.55, -0.44 + i * 0.08, 0], [-0.44 + i * 0.08, -0.55, Math.PI / 2], [-0.44 + i * 0.08, 0.55, Math.PI / 2]]) {
    const p = malla(new THREE.BoxGeometry(0.12, 0.025, 0.035), oro, chip); p.position.set(x, -0.05, z); p.rotation.y = ry;
  }
  for (const [x, z, alto, c] of [[-1.0, -0.6, 0.45, 0x1f3f8f], [-1.0, 0.1, 0.35, 0x1f3f8f], [0.95, 0.75, 0.3, 0x222222], [0.95, -0.7, 0.4, 0x1f3f8f]]) {
    const cond = malla(new THREE.CylinderGeometry(0.13, 0.13, alto, 40), mat.plastico(c, 0.35), placa); cond.position.set(x, 0.04 + alto / 2, z);
    malla(new THREE.CylinderGeometry(0.12, 0.12, 0.02, 40), mat.metal(0xb8bcc4, 0.3), cond).position.y = alto / 2 + 0.005;
  }
  const conector = malla(geo.caja(1.6, 0.3, 0.35, 0.03), mat.plastico(0x111215, 0.6), placa); conector.position.set(0, 0.19, 1.0);
  for (let i = 0; i < 14; i++) malla(new THREE.BoxGeometry(0.035, 0.18, 0.035), oro, conector).position.set(-0.65 + i * 0.1, 0.06, -0.06);
  const led = malla(new THREE.SphereGeometry(0.05, 24, 24), mat.emisivo(0x3ddc84, 2.5), placa); led.position.set(0.6, 0.08, -0.6);
  const brilloLed = halo(led, { color: '#3ddc84', tam: 0.6, opacidad: 0.8 });
  cada(t => { brilloLed.material.opacity = 0.5 + 0.4 * Math.sin(t * 8); });

  // ================= Guion visual =================
  // Sombras siguiendo a la parte de la escena que sale en cada momento.
  cada(t => sombras(t < f(2) + 0.5 ? { centro: [0, -0.3, 0], tam: 2.2 } : t < f(7) ? { centro: [0, Y, 0], tam: 3.5 } : { centro: [X, Y, 0], tam: 2.5 }));

  // 0. Gancho: macro del pomo, la R se resalta y la palanca va hacia ella.
  fondo.ponerBrillo('#ffa040', 0.24);
  camara.poner({ pos: [1.0, 1.3, 3.0], mira: [0.0, 0.55, 0.1], fov: 32 });
  camara.ir({ pos: [0.55, 1.15, 2.7] }, { t: 0, dur: f(2), ease: 'lineal' });
  dof.apertura = 1.8;
  ui.numero({ texto: '120', unidad: 'km/h', tam: 210, t: 0.05, hasta: f(2), y: 560 });
  ui.circulo({ ancla: marcaR, r: 78, color: '#ff4d5e', t: palabra(0, 'marcha'), hasta: f(1) + 0.4 });
  tween(palanca.rotation, { z: -0.13, x: 0.12 }, { t: palabra(0, 'metes'), dur: 0.7, ease: 'muelle' });
  // 1. Spoiler: no entra (la palanca rebota).
  const tno = palabra(1, 'no');
  tween(palanca.rotation, { z: 0, x: 0 }, { t: tno, dur: 0.8, ease: 'jugueton' });   // rebota al no entrar
  ui.sello('NO ENTRA', { t: tno, hasta: f(2), y: 1320 });
  fx.temblor({ t: tno, dur: 0.35, fuerza: 0.03 });

  // 2. Bajamos a la caja: el eje de salida gira a miles de rpm.
  camara.ir({ pos: [2.6, Y + 2.1, 8.0], mira: [0.6, Y - 0.15, 0], fov: 34 }, { t: f(2) - 0.1, dur: 1.5 });
  tween(dof, { apertura: 1.4 }, { t: f(2), dur: 1 });
  ui.giro({ ancla: A, r: 200, sentido: 'horario', t: palabra(2, 'gira'), hasta: f(3) });
  ui.etiqueta('~4.000 rpm', { ancla: A, offset: [0, -1.5, 0.3], color: '#2ee6f0', t: palabra(2, 'miles'), hasta: f(3) });
  ui.nota('Coche medio a 120 km/h, eje de salida de la caja', { t: palabra(2, 'miles') + 0.3, hasta: f(3) });

  // 3. El piñón loco invierte el giro.
  camara.ir({ pos: [-1.5, Y + 1.5, 7.6], mira: [-0.7, Y - 0.25, 0.4] }, { t: f(3), dur: 1.2 });
  ui.caja({ ancla: B, w: 330, h: 330, rotulo: 'PIÑÓN LOCO', t: palabra(3, 'loco'), hasta: f(4) });
  ui.giro({ ancla: B, r: 110, sentido: 'antihorario', color: '#a46bff', t: palabra(3, 'invierte'), hasta: f(4) });
  ui.giro({ ancla: C, r: 130, sentido: 'horario', color: '#2ee6f0', t: palabra(3, 'invierte') + 0.25, hasta: f(4) });

  // 4. Quieto contra uno a toda pastilla: vista lateral, fantasma de dónde tiene que entrar.
  camara.ir({ pos: [-6.2, Y + 2.0, 5.4], mira: [-0.3, Y + 0.05, 0.45] }, { t: f(4), dur: 1.4 });
  ui.etiqueta('0 rpm', { ancla: B, offset: [0, -0.95, 0], color: '#a46bff', t: palabra(4, 'quieto'), hasta: f(5) });
  ui.etiqueta('~4.000 rpm', { ancla: A, offset: [0, -1.45, 0], color: '#2ee6f0', t: palabra(4, 'toda'), hasta: f(5) });
  const fantasma = malla(geo.engranaje(nB, rB, G, { agujero: 0.3 }), mat.vidrio(0xbff4ff, 0), caja); fantasma.position.set(pB.x, pB.y, 0);
  const aristas = bordes(fantasma, { color: '#2ee6f0', opacidad: 0 });
  for (const [m, v] of [[fantasma.material, 0.14], [aristas.material, 0.9]]) {
    tween(m, { opacity: v }, { t: palabra(4, 'encajar'), dur: 0.4 });
    tween(m, { opacity: 0 }, { t: f(5) + 0.2, dur: 0.3 });
  }
  tween(B.position, { z: 0.5 }, { t: palabra(4, 'encajar'), dur: 1.3, ease: 'pesado' });

  // 5. Sin sincronizador: los dientes chocan y rasca. Macro del contacto.
  const tc = palabra(5, 'chocan');
  camara.ir({ pos: [0.6, Y - 0.1, 3.1], mira: contacto, fov: 30 }, { t: f(5), dur: 1.0 });
  tween(dof, { apertura: 2.4 }, { t: f(5), dur: 1.0 });
  ui.tarjeta({ titulo: 'Sincronizador', valor: '✕ no lleva', acento: '#ff4d5e', t: palabra(5, 'sincronizador'), hasta: f(6), y: 1330 });
  [[0, 0.06], [0.28, 0.34], [0.55, 0.07], [0.8, 0.3], [1.05, 0.08], [1.3, 0.32]].forEach(([dt, z]) =>
    tween(B.position, { z }, { t: tc - 0.2 + dt, dur: 0.2, ease: z < 0.1 ? 'entra' : 'sale' }));
  fx.chispas({ ancla: contacto, t: tc, dur: 1.4, n: 170 });
  fx.temblor({ t: tc, dur: 1.4, fuerza: 0.03 });
  const puntoChoque = new THREE.Object3D(); puntoChoque.position.set(...contacto); escena.add(puntoChoque);
  const fogonazo = halo(puntoChoque, { color: '#ffb347', tam: 1.6, opacidad: 0 });
  [[0, 1], [0.15, 0.2], [0.55, 1], [0.7, 0.2], [1.05, 0.9], [1.25, 0.1], [1.5, 0]].forEach(([dt, v]) => {
    tween(fogonazo.material, { opacity: v }, { t: tc + dt, dur: 0.1 });
    tween(A.material, { emissiveIntensity: v * 0.6 }, { t: tc + dt, dur: 0.12 });
  });
  cada(t => { const k = t - tc; B.rotation.z = k > 0 && k < 1.5 ? 0.05 * Math.sin(k * 70) * (1 - k / 1.5) : 0; });
  ui.etiqueta('¡rasca!', { ancla: contacto, offset: [-0.15, 0.5, 0], color: '#ff4d5e', t: palabra(5, 'rasca'), hasta: f(6) });

  // 6. Si la fuerzas, partes dientes: el diente sale volando hacia cámara.
  const tp = palabra(6, 'partir');
  camara.ir({ pos: [-2.2, Y + 1.3, 4.8], mira: [-0.45, Y + 0.25, 0.3], fov: 32 }, { t: f(6), dur: 0.9 });
  tween(dof, { exposicion: 0.8 }, { t: f(6), dur: 0.6 });   // el engranaje grande refleja mucha luz desde este ángulo
  tween(dof, { exposicion: 1 }, { t: f(7), dur: 0.6 });
  tween(B.position, { z: 0.05 }, { t: tp - 0.25, dur: 0.2, ease: 'entra' });
  color(matDiente.color, 0xff4d5e, { t: tp - 0.1, dur: 0.2 });
  tween(matDiente, { emissiveIntensity: 0.9 }, { t: tp - 0.1, dur: 0.2 });
  tween(diente.position, { x: -0.5, y: 0.45, z: 2.6 }, { t: tp + 0.1, dur: 1.3, ease: 'sale' });
  tween(diente.rotation, { x: 6, y: 3, z: 8 }, { t: tp + 0.1, dur: 1.3, ease: 'sale' });
  fx.chispas({ ancla: contacto, t: tp, dur: 0.35, n: 70, semilla: 9 });
  fx.temblor({ t: tp, dur: 0.4, fuerza: 0.06 });
  ui.etiqueta('diente partido', { ancla: contacto, offset: [0, -0.7, 0], color: '#ff4d5e', t: tp + 0.35, hasta: f(7) });

  // 7. Automático: barrido hacia la centralita, que ignora la orden.
  const ta = f(7);
  camara.ir({ pos: [X + 0.5, Y + 2.7, 4.7], mira: [X, Y + 0.3, 0], fov: 34 }, { t: ta - 0.1, dur: 1.0 });
  tween(dof, { apertura: 1.6 }, { t: ta, dur: 1 });
  fondo.brillo('#2ee6f0', { t: ta, dur: 1.0, a: 0.2 });
  ui.etiqueta('orden: marcha atrás', { y: 560, color: '#2ee6f0', t: palabra(7, 'centralita'), hasta: f(8) });
  ui.tarjeta({ titulo: 'Centralita', valor: 'R → ignorada', acento: '#3ddc84', t: palabra(7, 'ignora'), hasta: f(8), y: 1330 });

  // 8. Llamada a compartir: la cámara se aleja y la placa queda desenfocada detrás del móvil.
  camara.ir({ pos: [X + 0.6, Y + 2.6, 6.5], mira: [X + 0.3, Y + 1.7, 3.6] }, { t: f(8), dur: 1.2 });   // enfoca delante: la placa queda borrosa
  tween(dof, { apertura: 2.5 }, { t: f(8), dur: 0.8 });
  fondo.brillo('#4f7dff', { t: f(8), dur: 0.8, a: 0.22 });
  ui.compartir({ previa: '¿Marcha atrás a 120 km/h? 🚗💥', t: f(8) + 0.1, y: 1170 });
}
