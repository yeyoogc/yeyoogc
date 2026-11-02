// ¿Qué pasa si caes en un agujero negro? Estilo ilustrado: mundo 'espacio', astronauta estilizado, disco de acreción
// emisivo con resplandor. El astronauta cae de pie, se estira (espaguetización), su amigo lo ve frenarse y enrojecer,
// y en un agujero gigante cruza el borde sin notar nada.
export default function crear(ctx) {
  const { THREE, escena, f, fin, palabra, tween, cada, acumulado, mat, geo, ui, fx, camara, dof, mundo, persona, sonido, mirarCamara } = ctx;
  mundo('espacio');
  dof.apertura = 0.9; dof.resplandor = 0.6;

  // ---------- agujero negro: horizonte, disco de acreción y anillo de luz desviada ----------
  const R = 2;
  const agujero = new THREE.Group(); escena.add(agujero);
  const horizonte = new THREE.Mesh(new THREE.SphereGeometry(R, 64, 48), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  horizonte.userData.sinSombra = true; agujero.add(horizonte);
  const discoMat = (rin, rout, fuerza) => new THREE.ShaderMaterial({
    uniforms: { T: { value: 0 }, rin: { value: rin }, rout: { value: rout }, fuerza: { value: fuerza } },
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float T, rin, rout, fuerza; varying vec2 vP;
      void main(){
        float r = length(vP), a = atan(vP.y, vP.x), k = clamp((r - rin) / (rout - rin), 0.0, 1.0);
        float g = a + T * 1.4 / (0.35 + k * 1.8);                        // lo de dentro gira más rápido
        float bandas = 0.62 + 0.38 * sin(g * 3.0 + r * 5.0) * sin(g * 7.0 - r * 3.0 + 1.3);
        vec3 c = mix(vec3(4.0, 3.5, 2.8), vec3(3.2, 1.2, 0.3), smoothstep(0.0, 0.3, k));
        c = mix(c, vec3(0.9, 0.16, 0.05), smoothstep(0.3, 0.85, k));
        float alfa = (1.0 - smoothstep(0.55, 1.0, k)) * smoothstep(0.0, 0.05, k);
        gl_FragColor = vec4(c * bandas * alfa * fuerza, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const disco = new THREE.Mesh(new THREE.RingGeometry(R * 1.3, R * 3.2, 160, 4), discoMat(R * 1.3, R * 3.2, 0.75));
  disco.rotation.x = -Math.PI / 2 + 0.12; disco.userData.sinSombra = true; agujero.add(disco);
  // La luz de la parte de atrás del disco se curva por encima y por debajo: un anillo que siempre mira a la cámara.
  const lente = new THREE.Mesh(new THREE.RingGeometry(R * 1.02, R * 1.75, 160, 2), discoMat(R * 1.02, R * 1.75, 0.45));
  lente.userData.sinSombra = true; agujero.add(lente);
  const lenteIn = new THREE.Mesh(new THREE.RingGeometry(R * 1.0, R * 1.06, 160, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.6, 2.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  agujero.add(lenteIn);
  mirarCamara(lente); mirarCamara(lenteIn);
  cada(T => { disco.material.uniforms.T.value = T; lente.material.uniforms.T.value = T * 0.8; });

  // ---------- astronauta que cae (de pie: los pies apuntan al agujero) ----------
  // Su reloj propio se frena cerca del borde (lo que ve el amigo): poses a cámara lenta sin saltos.
  const lentitud = t => (t < f(9) ? 1 : t < fin(10) ? 1 - 0.97 * Math.min(1, (t - f(9)) / (fin(10) - f(9) - 0.5)) : 0.03);
  const relojAstro = acumulado(t => lentitud(t));
  const astro = persona({ traje: 'astronauta', poses: [[0, 'flotar']], reloj: relojAstro });
  // Cae en vertical, de pie, hacia el agujero que tiene debajo: en un vídeo vertical, el estirón llena la pantalla.
  // z es la altura sobre el centro del agujero (el borde está en z = R).
  const trayecto = new THREE.Group(); trayecto.rotation.x = -Math.PI / 2; escena.add(trayecto);
  const enTrayecto = z => new THREE.Vector3(0.15, 0, z).applyEuler(trayecto.rotation).toArray();
  const cuerpoAstro = new THREE.Group(); cuerpoAstro.add(astro); astro.position.y = -0.9; trayecto.add(cuerpoAstro);
  cuerpoAstro.rotation.set(Math.PI / 2, Math.PI / 2, 0);   // tumbado (cabeza hacia +z, pies hacia el agujero) y de cara a +x, donde suele estar la cámara
  const pies = new THREE.Object3D(); pies.position.y = -0.85; astro.userData.partes.cI.add(pies);
  const cabeza = new THREE.Object3D(); cabeza.position.y = 0.15; astro.userData.partes.cab.add(cabeza);
  const torso = astro.userData.partes.torso;
  // Recorrido: de lejos al borde. z es la distancia al centro del agujero (el borde está en z = R).
  const caida = { z: 7.2 }, estira = { k: 0 }, rojo = { k: 0 }, apaga = { k: 0 };
  tween(caida, { z: 5.6 }, { t: 0, dur: f(7), ease: 'lineal' });
  tween(caida, { z: 4.0 }, { t: f(8), dur: f(9) - f(8), ease: 'inOut' });
  tween(caida, { z: R + 0.45 }, { t: f(9), dur: fin(10) - f(9) - 0.4, ease: 'sale' });   // se frena al llegar al borde
  cada(T => {
    cuerpoAstro.position.set(0.15, 0, caida.z);
    cuerpoAstro.rotation.z = Math.sin(relojAstro(T) * 0.35) * 0.25;
    const e = estira.k;
    const fino = 1 - 0.45 * Math.min(e, 1) - 0.12 * Math.max(0, e - 1);
    cuerpoAstro.scale.set(fino, 1 + 1.3 * e, fino);
  });
  // Colores: rojo y apagado (corrimiento al rojo visto desde fuera).
  const piezas = []; astro.traverse(o => { if (o.isMesh && o.material.color) piezas.push({ m: o.material, base: o.material.color.clone() }); });
  const ROJO = new THREE.Color('#ff3b1f'), NEGRO = new THREE.Color('#120302');
  cada(() => { for (const p of piezas) p.m.color.copy(p.base).lerp(ROJO, rojo.k).lerp(NEGRO, apaga.k); });

  // ---------- amigo con su nave, lejos ----------
  const amigo = persona({ traje: 'astronauta', poses: [[0, 'flotar']], fase: 3 });
  amigo.position.set(9, 6.8, 13); amigo.rotation.y = -2.6; escena.add(amigo);
  const nave = new THREE.Group(); nave.position.set(11.5, 7.6, 15); nave.rotation.set(0.2, 0.9, 0.15); escena.add(nave);
  const casco = new THREE.Mesh(geo.torno([[0, 0], [0.55, 0.15], [0.7, 0.8], [0.62, 1.8], [0.3, 2.5], [0, 2.7]], 48), mat.metal(0xe8eaee, 0.35)); nave.add(casco);
  const ventana = new THREE.Mesh(new THREE.CircleGeometry(0.22, 32), mat.emisivo('#7fd8ff', 1.4)); ventana.position.set(0, 1.7, 0.66); ventana.rotation.x = -0.05; nave.add(ventana);
  for (let i = 0; i < 3; i++) {
    const aleta = new THREE.Mesh(geo.extruir(new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0.55, -0.15), new THREE.Vector2(0.5, 0.6), new THREE.Vector2(0, 0.7)]), 0.06, 0.02), mat.plastico(0xd64545, 0.4));
    aleta.position.y = 0.1; aleta.rotation.y = (i / 3) * Math.PI * 2; aleta.translateX(0.6); nave.add(aleta);
  }
  const fuego = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 24, 1, true), mat.emisivo('#ffb347', 2.2)); fuego.position.y = -0.4; fuego.rotation.x = Math.PI; nave.add(fuego);
  cada(T => { const v = T >= f(7) - 0.2 && T < f(11); amigo.visible = nave.visible = v; fuego.scale.y = 0.85 + 0.15 * Math.sin(T * 30); });

  // ---------- planos ----------
  // La cámara mira desde +x (lo que queda a +z sale a la izquierda de la pantalla). Altura del astronauta en la primera parte:
  const zEn = t => 7.2 - 1.6 * Math.min(1, t / f(7)), aq = t => enTrayecto(zEn(t));
  const junto = (t, [dx, dy, dz]) => { const p = aq(t); return [p[0] + dx, p[1] + dy, p[2] + dz]; };
  camara.poner({ pos: [14, 10, 5.5], mira: [0, 4.9, 0], fov: 40 });
  camara.ir({ pos: [12, 9, 4.5], mira: [0, 5.1, 0] }, { t: 0, dur: f(1), ease: 'inOut' });
  // 1. "No es una forma de hablar": primer plano y un estirón de aviso
  camara.ir({ pos: junto(f(2), [5.5, 0.8, 1.8]), mira: aq(f(2)), fov: 38 }, { t: f(1), dur: 1.1 });
  tween(estira, { k: 0.35 }, { t: palabra(1, 'forma'), dur: 0.35, ease: 'rapido' });
  tween(estira, { k: 0 }, { t: palabra(1, 'forma') + 0.4, dur: 0.6, ease: 'muelle' });
  fx.temblor({ t: palabra(1, 'forma'), dur: 0.3, fuerza: 0.03 });
  // 2. La gravedad tira más cuanto más cerca: tres flechas hacia abajo, más largas cuanto más abajo
  camara.ir({ pos: [14.5, 6.8, 2.4], mira: [0, 4.9, 0.6], fov: 42 }, { t: f(2), dur: 1.3 });
  const alturas = [7.6, 5.5, 3.5], largos = [0.5, 1.1, 2.0], fuerzas = ['×1', '×4', '×16'];
  alturas.forEach((h, i) => {
    const t = palabra(2, 'gravedad') + i * 0.35, a = [0.15, h, 1.7], b = [0.15, h - largos[i], 1.7];
    ui.flecha({ desde: { ancla: a }, hacia: { ancla: b }, color: '#ff9b3d', grosor: 10, t, hasta: fin(2) });
    ui.etiqueta(fuerzas[i], { ancla: a, offset: [0, -largos[i] / 2, 0.9], color: '#ff9b3d', t: t + 0.1, hasta: fin(2), linea: false });
  });
  // 3-4. Pies más cerca que la cabeza: tiran más de los pies
  camara.ir({ pos: junto(f(4), [5.8, 0.6, 1.2]), mira: aq(f(4)), fov: 36 }, { t: f(3), dur: 1.0 });
  ui.etiqueta('pies', { ancla: pies, offset: [0, 0, 1.1], color: '#ff9b3d', t: palabra(3, 'pies'), hasta: fin(4) });
  ui.etiqueta('cabeza', { ancla: cabeza, offset: [0, 0.2, 1.1], color: '#ffffff', t: palabra(3, 'cabeza'), hasta: fin(4) });
  ui.flecha({ desde: { ancla: pies }, hacia: { ancla: pies, offset: [0, -0.7, 0] }, color: '#ff9b3d', grosor: 10, t: f(4), hasta: fin(4) });
  ui.flecha({ desde: { ancla: cabeza, offset: [0, 0.3, 0] }, hacia: { ancla: cabeza, offset: [0, 0.05, 0] }, color: '#ffffff', grosor: 6, t: f(4) + 0.15, hasta: fin(4) });
  // 5-6. Te estira y te aprieta: espaguetización (el cuerpo se estira de arriba abajo y llena la pantalla)
  camara.ir({ pos: junto(f(6), [5.6, 0.2, 0.9]), mira: junto(f(6), [0, 0.2, 0]), fov: 40 }, { t: f(5), dur: 1.0 });
  camara.ir({ pos: junto(f(7), [6.6, -0.2, 1.0]), mira: junto(f(7), [0, -0.3, 0]), fov: 40 }, { t: f(6), dur: 1.4, ease: 'pesado' });
  tween(estira, { k: 0.9 }, { t: palabra(5, 'estira'), dur: 1.2, ease: 'pesado' });
  ui.flecha({ desde: { ancla: torso, offset: [0, 0, 1.0] }, hacia: { ancla: torso, offset: [0, 0, 0.4] }, color: '#ff4d5e', grosor: 8, t: palabra(5, 'aprieta'), hasta: fin(5) });
  ui.flecha({ desde: { ancla: torso, offset: [0, 0, -1.0] }, hacia: { ancla: torso, offset: [0, 0, -0.4] }, color: '#ff4d5e', grosor: 8, t: palabra(5, 'aprieta') + 0.1, hasta: fin(5) });
  tween(estira, { k: 1.6 }, { t: f(6), dur: 1.4, ease: 'pesado' });
  ui.sello('ESPAGUETIZACIÓN', { y: 1330, color: '#ff9b3d', t: palabra(6, 'espaguetización') });
  // 7-8. Pero aquí viene lo raro: el amigo, desde lejos (se vuelve a la forma normal para la segunda parte)
  tween(estira, { k: 0 }, { t: f(7), dur: 0.01, ease: 'lineal' });
  camara.ir({ pos: [30, 12, 36], mira: [5, 4.6, 6], fov: 40 }, { t: f(7) - 0.1, dur: 1.4 });
  camara.ir({ pos: [19, 8.2, 12.5], mira: [0, 2.6, 0], fov: 30 }, { t: f(8), dur: 1.2 });
  ui.etiqueta('tú', { ancla: cuerpoAstro, offset: [0, 1.2, 0], color: '#ff9b3d', t: palabra(8, 'nunca'), hasta: fin(9) });
  // 9-10. Más lento, más rojo... congelado en el borde y se apaga
  camara.ir({ pos: [15, 6.5, 9.5], mira: [0, 2.4, 0], fov: 24 }, { t: f(9), dur: fin(10) - f(9), ease: 'inOut' });
  tween(rojo, { k: 1 }, { t: palabra(9, 'rojo') - 0.6, dur: 1.6, ease: 'inOut' });
  ui.cifra({ texto: t => `${Math.max(1, Math.round(100 * lentitud(t)))} %`, unidad: 'de velocidad', tam: 96, t: palabra(9, 'lento'), hasta: fin(10) - 0.3, y: 1300 });
  tween(apaga, { k: 1 }, { t: palabra(10, 'apagas') - 0.2, dur: 0.9, ease: 'entra' });
  // 11. Para ti, el reloj sigue normal: primer plano, colores de vuelta
  tween(rojo, { k: 0 }, { t: f(11), dur: 0.01, ease: 'lineal' }); tween(apaga, { k: 0 }, { t: f(11), dur: 0.01, ease: 'lineal' });
  tween(caida, { z: 4.6 }, { t: f(11), dur: 0.01, ease: 'lineal' });
  camara.ir({ pos: [4.6, 5.4, 2.0], mira: enTrayecto(4.7), fov: 34 }, { t: f(11) - 0.05, dur: 0.6 });
  ui.cifra({ texto: t => `00:0${Math.min(9, Math.floor(1 + Math.max(0, t - f(11)) * 1.0))}`, unidad: 'tu reloj', tam: 100, t: f(11) + 0.2, hasta: fin(11), y: 1300 });
  // 12. Agujero gigante: cruzas el borde sin notar nada
  const gigante = { k: 1 };
  tween(gigante, { k: 6 }, { t: f(12), dur: 1.6, ease: 'inOut' });
  cada(T => { agujero.scale.setScalar(gigante.k); });
  tween(caida, { z: 24 }, { t: f(12), dur: 0.01, ease: 'lineal' });
  tween(caida, { z: 10.5 }, { t: f(12) + 0.6, dur: fin(12) - f(12) - 0.6, ease: 'inOut' });
  camara.ir({ pos: [62, 22, 24], mira: [0, 10, 0], fov: 44 }, { t: f(12) - 0.1, dur: 1.6 });
  ui.etiqueta('tú', { ancla: cuerpoAstro, offset: [0, 2, 0], color: '#ff9b3d', t: f(12) + 0.8, hasta: fin(12) });
  ui.cifra({ texto: '4 millones', unidad: 'de soles', tam: 104, t: palabra(12, 'galaxia'), hasta: fin(12), y: 1300 });
  // 13. Dentro, todos los caminos llevan al centro
  tween(gigante, { k: 1 }, { t: f(13), dur: 0.01, ease: 'lineal' });
  camara.ir({ pos: [8, 2.4, 2.5], mira: [0, 0.4, 0], fov: 46 }, { t: f(13) - 0.05, dur: 1.0 });
  const centro = [540, 960];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.3, r = 430;
    ui.flecha({ desde: [centro[0] + Math.cos(a) * r, centro[1] + Math.sin(a) * r * 1.15], hacia: [centro[0] + Math.cos(a) * 70, centro[1] + Math.sin(a) * 80], curva: 0.18, color: '#ff9b3d', grosor: 6, t: palabra(13, 'todos') + i * 0.07, hasta: fin(13) });
  }
  // 14. Remate: fideo a cámara lenta
  tween(caida, { z: 6.2 }, { t: f(14), dur: 0.01, ease: 'lineal' });
  tween(caida, { z: 4.6 }, { t: f(14) + 0.01, dur: fin(14) - f(14), ease: 'lineal' });
  tween(estira, { k: 2.0 }, { t: f(14), dur: 0.01, ease: 'lineal' });
  camara.ir({ pos: [11, 5.6, 3.5], mira: [0, 4.4, 0], fov: 42 }, { t: f(14) - 0.05, dur: 0.8 });
  // 15. Compartir
  camara.ir({ pos: [14, 4, 6], mira: [0, 2, 0], fov: 40 }, { t: f(15), dur: 1.2 });
  tween(dof, { apertura: 2.4 }, { t: f(15), dur: 0.8 });
  ui.compartir({ previa: '¿Qué pasa si caes en un agujero negro? 🕳️', nombres: ['Dani', 'Irene', 'Pablo'], t: palabra(15, 'amigo') - 0.3, hasta: fin(15) + 1 });
  sonido('whoosh', f(12), { dur: 1.4 });
}
