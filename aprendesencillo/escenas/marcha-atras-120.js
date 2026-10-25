// ¿Qué pasa si metes la marcha atrás a 120? Caja de cambios simplificada: el engranaje del eje de salida
// gira a tope y el piñón loco (quieto) intenta entrar, choca, rasca y acaba perdiendo un diente.
export default function crear({ THREE, escena, f, palabra, tween, cada, mat, geo, ui, fx, color, camara, fondo }) {
  const rA = 1.15, nA = 26, rB = 0.62, nB = 14, GROSOR = 0.34, ROTO = 13;
  const d = rA + rB - (2.5 * rA) / nA, ang = (155 * Math.PI) / 180;
  const posA = new THREE.Vector3(0.7, -0.15, 0);
  const posB = posA.clone().add(new THREE.Vector3(Math.cos(ang) * d, Math.sin(ang) * d, 0));
  const contacto = [posA.x + Math.cos(ang) * (rA - 0.05), posA.y + Math.sin(ang) * (rA - 0.05), 0.2];

  // --- caja de cambios ---
  const caja = new THREE.Group(); escena.add(caja);
  const acero = mat.metal(0xc3c8d0, 0.28), oscuro = mat.metal(0x6b707a, 0.4);
  const A = new THREE.Mesh(geo.engranaje(nA, rA, GROSOR, { aligerado: 5 }), acero); A.position.copy(posA); caja.add(A);
  const ejeA = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 3.6, 40), oscuro); ejeA.rotation.x = Math.PI / 2; ejeA.position.copy(posA); caja.add(ejeA);
  const cuboA = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.5, 40), acero); cuboA.rotation.x = Math.PI / 2; A.add(cuboA);

  const B = new THREE.Group(); B.position.set(posB.x, posB.y, 1.1); caja.add(B);
  const aceroB = mat.metal(0xd2c3a8, 0.3);
  B.add(new THREE.Mesh(geo.engranaje(nB, rB, GROSOR, { agujero: 0.28, sinDiente: ROTO }), aceroB));
  const ejeB = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.4, 32), oscuro); ejeB.rotation.x = Math.PI / 2; B.add(ejeB);
  const matDiente = aceroB.clone();
  const diente = new THREE.Mesh(geo.diente(nB, rB, GROSOR, ROTO), matDiente); B.add(diente);

  cada(t => { A.rotation.z = -2.2 * t; });

  // --- 0-1: gancho ---
  fondo.ponerBrillo('#ffa040', 0.22);
  camara.poner({ pos: [0.4, 2.2, 10.5], mira: [0.1, 0.55, 0], fov: 38 });
  camara.ir({ pos: [0.2, 1.7, 9.2] }, { t: 0, dur: f(1) + 0.5, ease: 'lineal' });
  ui.numero({ texto: '120', unidad: 'km/h', tam: 230, t: 0.05, hasta: f(2), y: 640 });
  ui.sello('NO ENTRA', { t: palabra(1, 'no'), hasta: f(2), y: 1300 });
  fx.temblor({ t: palabra(1, 'no'), dur: 0.3, fuerza: 0.05 });

  // --- 2: el eje de salida va a miles de rpm ---
  camara.ir({ pos: [1.2, 1.0, 7.2], mira: [0.7, -0.05, 0] }, { t: f(2), dur: 1.3 });
  ui.giro({ ancla: A, r: 230, sentido: 'horario', t: palabra(2, 'gira'), hasta: f(3) });
  ui.etiqueta('~4.000 rpm', { ancla: A, offset: [0, -1.5, 0], color: '#2ee6f0', t: palabra(2, 'miles'), hasta: f(3) });
  ui.nota('Coche medio a 120 km/h, eje de salida de la caja', { t: palabra(2, 'miles') + 0.3, hasta: f(3) });

  // --- 3: el piñón loco invierte el giro ---
  camara.ir({ pos: [-0.7, 1.3, 6.4], mira: [-0.5, 0.35, 0.5] }, { t: f(3), dur: 1.2 });
  ui.caja({ ancla: B, w: 620, h: 620, rotulo: 'PIÑÓN LOCO', t: palabra(3, 'loco'), hasta: f(4) });
  ui.giro({ ancla: B, r: 170, sentido: 'antihorario', color: '#a46bff', t: palabra(3, 'invierte'), hasta: f(4) });

  // --- 4: quieto contra uno a toda pastilla (vista de lado para ver que no están alineados) ---
  camara.ir({ pos: [-3.6, 1.7, 5.6], mira: [-0.2, 0.25, 0.45] }, { t: f(4), dur: 1.4 });
  ui.etiqueta('0 rpm', { ancla: B, offset: [0, -0.95, 0], color: '#a46bff', t: palabra(4, 'quieto'), hasta: f(5) });
  ui.etiqueta('~4.000 rpm', { ancla: A, offset: [0, -1.45, 0], color: '#2ee6f0', t: palabra(4, 'toda'), hasta: f(5) });
  tween(B.position, { z: 0.5 }, { t: palabra(4, 'encajar'), dur: 1.3 });

  // --- 5: choque, rasca, no entra ---
  const tc = palabra(5, 'chocan');
  camara.ir({ pos: [-1.1, 1.0, 4.9], mira: [-0.35, 0.3, 0.2] }, { t: f(5), dur: 1.0 });
  ui.tarjeta({ titulo: 'Sincronizador', valor: '✕ no lleva', acento: '#ff4d5e', t: palabra(5, 'sincronizador'), hasta: f(6), y: 1340 });
  [[0, 0.06], [0.28, 0.34], [0.55, 0.07], [0.8, 0.3], [1.05, 0.08], [1.3, 0.32]].forEach(([dt, z]) =>
    tween(B.position, { z }, { t: tc - 0.2 + dt, dur: 0.2, ease: z < 0.1 ? 'entra' : 'sale' }));
  fx.chispas({ ancla: contacto, t: tc, dur: 1.4, n: 160 });
  fx.temblor({ t: tc, dur: 1.4, fuerza: 0.05 });
  A.material = acero.clone(); A.material.emissive.set(0xff6a00); A.material.emissiveIntensity = 0;
  [[0, 0.7], [0.3, 0.1], [0.55, 0.7], [0.85, 0.1], [1.1, 0.6], [1.5, 0]].forEach(([dt, v]) =>
    tween(A.material, { emissiveIntensity: v }, { t: tc + dt, dur: 0.15 }));
  cada(t => { const k = t - tc; B.rotation.z = k > 0 && k < 1.5 ? 0.05 * Math.sin(k * 70) * (1 - k / 1.5) : 0; });
  ui.etiqueta('¡rasca!', { ancla: contacto, offset: [-0.2, 0.55, 0], color: '#ff4d5e', t: palabra(5, 'rasca'), hasta: f(6) });

  // --- 6: si la fuerzas, partes dientes ---
  const tp = palabra(6, 'partir');
  camara.ir({ pos: [-1.6, 1.4, 5.4], mira: [-0.4, 0.4, 0.3] }, { t: f(6), dur: 0.9 });
  tween(B.position, { z: 0.05 }, { t: tp - 0.25, dur: 0.2, ease: 'entra' });
  color(matDiente.color, 0xff4d5e, { t: tp - 0.1, dur: 0.2 });
  matDiente.emissive.set(0xff2030); matDiente.emissiveIntensity = 0;
  tween(matDiente, { emissiveIntensity: 0.8 }, { t: tp - 0.1, dur: 0.2 });
  tween(diente.position, { x: -0.6, y: 0.5, z: 3.2 }, { t: tp + 0.1, dur: 1.2, ease: 'sale' });
  tween(diente.rotation, { x: 5, y: 3, z: 7 }, { t: tp + 0.1, dur: 1.1, ease: 'sale' });
  fx.chispas({ ancla: contacto, t: tp, dur: 0.35, n: 60, semilla: 9 });
  fx.temblor({ t: tp, dur: 0.4, fuerza: 0.09 });
  ui.etiqueta('diente partido', { ancla: contacto, offset: [0, -0.75, 0], color: '#ff4d5e', t: tp + 0.35, hasta: f(7) });

  // --- 7: en un automático, la centralita lo ignora ---
  const ecu = new THREE.Group(); ecu.position.set(0, 7, 0); ecu.rotation.set(0.15, -0.5, 0); escena.add(ecu);
  ecu.add(new THREE.Mesh(geo.caja(2.2, 0.22, 2.2, 0.05), mat.plastico(0x15171d, 0.45)));
  const oro = mat.oro();
  for (let i = 0; i < 10; i++) for (const [x, z, ry] of [[-1.16, -0.9 + i * 0.2, 0], [1.16, -0.9 + i * 0.2, 0], [-0.9 + i * 0.2, -1.16, Math.PI / 2], [-0.9 + i * 0.2, 1.16, Math.PI / 2]]) {
    const pata = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.07), oro); pata.position.set(x, -0.05, z); pata.rotation.y = ry; ecu.add(pata);
  }
  const rotulo = geo.textura((g, w, h) => {
    g.fillStyle = '#1b1e26'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 3; g.strokeRect(30, 30, w - 60, h - 60);
    g.fillStyle = '#e8ecf3'; g.font = '800 150px "JetBrains Mono"'; g.textAlign = 'center'; g.fillText('TCU', w / 2, h / 2 + 20);
    g.fillStyle = '#7d8596'; g.font = '700 36px "JetBrains Mono"'; g.fillText('CAMBIO AUTOMÁTICO', w / 2, h / 2 + 90);
  });
  const tapa = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9), new THREE.MeshStandardMaterial({ map: rotulo, roughness: 0.5 }));
  tapa.rotation.x = -Math.PI / 2; tapa.position.y = 0.111; ecu.add(tapa);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.06, 20, 20), mat.emisivo(0x3ddc84, 2)); led.position.set(0.75, 0.14, 0.75); ecu.add(led);

  const ta = f(7);
  tween(caja.position, { y: -7 }, { t: ta, dur: 0.9, ease: 'entra' });
  tween(ecu.position, { y: 0.3 }, { t: ta + 0.4, dur: 1.0, ease: 'sale' });
  cada(t => { ecu.rotation.y = -0.5 + 0.12 * Math.sin(t * 0.8); led.material.emissiveIntensity = 1.2 + Math.sin(t * 9); });
  camara.ir({ pos: [0, 3.2, 6.6], mira: [0, 0.1, 0] }, { t: ta, dur: 1.0 });
  fondo.brillo('#2ee6f0', { t: ta, dur: 1.0, a: 0.18 });
  ui.etiqueta('orden: marcha atrás', { y: 640, color: '#2ee6f0', t: palabra(7, 'centralita'), hasta: f(8) });
  ui.tarjeta({ titulo: 'Centralita', valor: 'R → ignorada', acento: '#3ddc84', t: palabra(7, 'ignora'), hasta: f(8), y: 1340 });

  // --- 8: llamada a compartir ---
  tween(ecu.position, { y: -7 }, { t: f(8), dur: 0.8, ease: 'entra' });
  fondo.brillo('#4f7dff', { t: f(8), dur: 0.8, a: 0.2 });
  ui.compartir({ previa: '¿Marcha atrás a 120 km/h? 🚗💥', t: f(8) + 0.1, y: 1170 });
}
