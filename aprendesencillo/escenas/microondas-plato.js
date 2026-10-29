// ¿Por qué gira el plato del microondas? Ondas estacionarias: zonas calientes y frías cada media onda (~6 cm);
// el plato pasea la comida por todas. Sin plato, el chocolate se derrite a manchas y con eso sale la velocidad de la luz.
// Escala: 1 unidad = 10 cm. La onda mide 12,2 cm = 1,22 unidades; las manchas, cada 0,61.
export default function crear(ctx) {
  const { THREE, escena, f, fin, palabra, tween, cada, mat, geo, ui, camara, mundo, dof, halo, frases, sombras } = ctx;
  mundo('azul');
  dof.apertura = 0.35; dof.resplandor = 0.55;
  const LAMBDA = 1.22, K = (2 * Math.PI) / LAMBDA, MEDIA = LAMBDA / 2;

  // ---------- encimera ----------
  const encimera = new THREE.Mesh(geo.caja(16, 0.5, 7, 0.08), mat.plano('#24364f')); encimera.position.set(0, -0.25, 0); escena.add(encimera);
  const azulejo = new THREE.Mesh(new THREE.PlaneGeometry(16, 9), mat.pintado((g, w, h) => {
    g.fillStyle = '#1b2b42'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 6;
    for (let x = 0; x <= w; x += w / 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y <= h; y += h / 9) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  }, { rugosidad: 0.6 })); azulejo.position.set(0, 4.3, -3.4); escena.add(azulejo);

  // ---------- microondas: carcasa, cavidad, puerta, panel ----------
  const MO = new THREE.Group(); escena.add(MO);
  const carcasa = mat.plastico(0xe9e6df, 0.45), interior = mat.plastico(0x7c8590, 0.4);   // chapa esmaltada gris: las ondas brillan sobre ella
  const CX = -0.7, CY = 1.55, CW = 3.4, CH = 2.4, CD = 3.2;   // centro y tamaño de la cavidad
  const SUELO = CY - CH / 2;
  const pieza = (g, m, p, padre = MO) => { const o = new THREE.Mesh(g, m); o.position.set(...p); padre.add(o); return o; };
  // La tapa (techo de fuera y de dentro, con el agitador) se levanta en corte para ver la cavidad desde arriba.
  const tapa = new THREE.Group(); MO.add(tapa);
  pieza(geo.caja(5.4, 0.18, 3.9, 0.06), carcasa, [0, 3.0, 0], tapa);
  pieza(new THREE.BoxGeometry(CW, 0.04, CD), interior, [CX, CY + CH / 2, 0], tapa);
  pieza(geo.caja(5.4, 0.2, 3.9, 0.06), carcasa, [0, 0.1, 0]);
  pieza(geo.caja(0.2, 2.8, 3.9, 0.06), carcasa, [-2.6, 1.55, 0]);
  pieza(geo.caja(1.5, 2.8, 3.9, 0.06), carcasa, [1.95, 1.55, 0]);
  pieza(geo.caja(5.4, 2.8, 0.18, 0.04), carcasa, [0, 1.55, -1.86]);
  // paredes interiores de metal (lo que hace rebotar las ondas)
  pieza(new THREE.BoxGeometry(CW, 0.04, CD), interior, [CX, SUELO, 0]);
  pieza(new THREE.BoxGeometry(0.04, CH, CD), interior, [CX - CW / 2, CY, 0]);
  pieza(new THREE.BoxGeometry(0.04, CH, CD), interior, [CX + CW / 2, CY, 0]);
  pieza(new THREE.BoxGeometry(CW, CH, 0.04), interior, [CX, CY, -CD / 2]);
  const luzIn = new THREE.PointLight('#ffd9a0', 0, 6); luzIn.position.set(CX + 1.2, CY + 0.9, 0.6); MO.add(luzIn);
  // panel de mandos con display
  pieza(geo.caja(1.3, 2.6, 0.08, 0.05), mat.pintado((g, w, h) => {
    g.fillStyle = '#d9d6cf'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#0d1a14'; g.fillRect(w * 0.12, h * 0.07, w * 0.76, h * 0.12);
    g.fillStyle = '#3ddc84'; g.font = `700 ${h * 0.085}px "JetBrains Mono"`; g.textAlign = 'center'; g.fillText('0:30', w / 2, h * 0.165);
    for (let i = 0; i < 9; i++) { g.fillStyle = '#bdb9b1'; g.beginPath(); g.roundRect(w * (0.14 + (i % 3) * 0.26), h * (0.3 + Math.floor(i / 3) * 0.1), w * 0.2, h * 0.07, 12); g.fill(); }
    g.fillStyle = '#9e9a92'; g.beginPath(); g.arc(w / 2, h * 0.78, w * 0.24, 0, 7); g.fill();
  }, { w: 256, h: 512, rugosidad: 0.5 }), [1.95, 1.6, 1.98]);
  // puerta con bisagra a la izquierda: cristal oscuro con rejilla de puntos y marco
  const bisagra = new THREE.Group(); bisagra.position.set(CX + 0.05 - 1.925, 1.55, 1.97); MO.add(bisagra);
  const puerta = new THREE.Group(); puerta.position.x = 1.925; bisagra.add(puerta);
  // marco con hueco: por el cristal se ve la cavidad encendida
  [[0, 1.1875, 3.85, 0.375], [0, -1.1875, 3.85, 0.375], [-1.7125, 0, 0.425, 2.0], [1.7125, 0, 0.425, 2.0]].forEach(([x, y, w, h]) => {
    const b = new THREE.Mesh(geo.caja(w, h, 0.1, 0.04), carcasa); b.position.set(x, y, 0); puerta.add(b);
  });
  const cristal = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 2.0), new THREE.MeshStandardMaterial({ map: (() => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 340; const g = c.getContext('2d');
    g.fillStyle = '#05070a'; g.fillRect(0, 0, 512, 340); g.fillStyle = 'rgba(40,48,58,1)';
    for (let y = 6; y < 340; y += 12) for (let x = 6 + ((y / 12) % 2) * 6; x < 512; x += 12) { g.beginPath(); g.arc(x, y, 3.2, 0, 7); g.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })(), roughness: 0.15, metalness: 0, transparent: true, opacity: 0.42, depthWrite: false }));
  cristal.position.z = 0.06; puerta.add(cristal);
  const tirador = new THREE.Mesh(geo.caja(0.12, 1.6, 0.18, 0.05), mat.plastico(0x9ea3aa, 0.3)); tirador.position.set(1.7, 0, 0.12); puerta.add(tirador);

  // ---------- plato giratorio con una tortilla ----------
  const plato = new THREE.Group(); plato.position.set(CX, SUELO + 0.12, 0); MO.add(plato);
  const aro = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.04, 8, 48).rotateX(Math.PI / 2), mat.plano('#3a3f48')); aro.position.y = -0.06; plato.add(aro);
  plato.add(new THREE.Mesh(geo.torno([[0, 0], [1.38, 0], [1.42, 0.06], [1.36, 0.08], [0, 0.03]], 64), mat.vidrio('#cfe8f0', 0.45)));
  // Calor en la cavidad: ondas estacionarias en x y z → manchas cada media onda (centradas en la cavidad).
  const CALOR = `float calor(vec2 p){ float a = cos(${K.toFixed(4)} * p.x), b = cos(${K.toFixed(4)} * p.y); return a * a * b * b; }`;
  const comidaMat = new THREE.ShaderMaterial({
    uniforms: { parejo: { value: 0 }, cocinado: { value: 0 }, centro: { value: new THREE.Vector2(CX, 0) } },
    vertexShader: 'varying vec3 vW; varying vec3 vL; varying vec3 vN; void main(){ vL = position; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `${CALOR} uniform float parejo, cocinado; uniform vec2 centro; varying vec3 vW; varying vec3 vL; varying vec3 vN;
      void main(){
        // tortilla: dorada, con tostados que giran con ella; el canto, más hecho
        float tostado = 0.5 + 0.5 * sin(vL.x * 9.0 + sin(vL.z * 7.0) * 1.6) * sin(vL.z * 8.0 + sin(vL.x * 5.0));
        vec3 base = mix(vec3(0.80, 0.47, 0.10), vec3(0.55, 0.26, 0.05), smoothstep(0.55, 0.95, tostado) * 0.7);
        base = mix(vec3(0.50, 0.24, 0.05), base, smoothstep(0.2, 0.7, vN.y));
        float c = calor(vW.xz - centro), k = cocinado * (1.0 - parejo);
        float cal = smoothstep(0.42, 0.9, c) * k, fri = (1.0 - smoothstep(0.04, 0.32, c)) * k;
        vec3 col = mix(base, vec3(0.42, 0.66, 1.0), fri * 0.85);
        col = mix(col, vec3(1.0, 0.16, 0.03), cal);
        col *= 1.0 + 0.18 * parejo * cocinado;
        float luz = 0.55 + 0.45 * max(dot(vN, normalize(vec3(0.4, 1.0, 0.6))), 0.0);
        gl_FragColor = vec4(col * luz + vec3(1.0, 0.25, 0.05) * cal * 1.4, 1.0);
      }`,
  });
  const fuente = new THREE.Mesh(geo.torno([[0, 0], [1.0, 0], [1.08, 0.12], [1.0, 0.14], [0, 0.14]], 48), mat.plano('#f2f2ee')); fuente.position.y = 0.06; plato.add(fuente);
  const tortilla = new THREE.Mesh(geo.torno([[0, 0], [0.86, 0], [0.94, 0.05], [0.96, 0.13], [0.9, 0.2], [0.75, 0.23], [0, 0.24]], 64), comidaMat);
  tortilla.position.y = 0.2; plato.add(tortilla);
  const mano = { quita: 0, vuelve: 0 };

  // ---------- ondas: cintas de luz (viajeras o estacionarias) ----------
  function onda({ x0, x1, y, z, color = '#2ee6f0', amp = 0.28, modo = 0, fase = 0, grosor = 0.035 }) {
    const L = x1 - x0, geo2 = new THREE.PlaneGeometry(L, grosor, 220, 1).translate(x0 + L / 2, 0, 0);
    const m = new THREE.ShaderMaterial({
      uniforms: { T: { value: 0 }, amp: { value: amp }, modo: { value: modo }, fase: { value: fase }, col: { value: new THREE.Color(color) }, brillo: { value: 0 } },
      vertexShader: `uniform float T, amp, modo, fase; void main(){
          float x = position.x, viaja = sin(${K.toFixed(4)} * x - T * 7.0 + fase), quieta = sin(${K.toFixed(4)} * x + fase) * cos(T * 7.0);
          vec3 p = position; p.y += amp * mix(viaja, quieta * 1.6, modo);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
      fragmentShader: 'uniform vec3 col; uniform float brillo; void main(){ gl_FragColor = vec4(col * 2.2 * brillo, 1.0); }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const o = new THREE.Mesh(geo2, m); o.position.set(0, y, z); o.userData.sinSombra = true; MO.add(o);
    cada(T => { m.uniforms.T.value = T; });
    return o;
  }
  const xa = CX - CW / 2 + 0.05, xb = CX + CW / 2 - 0.05;
  const ondas = [
    onda({ x0: xa, x1: xb, y: CY + 0.5, z: 0.3, color: '#2ee6f0' }),
    onda({ x0: xa, x1: xb, y: CY + 0.2, z: -0.2, color: '#ffd23f', fase: Math.PI, amp: 0.24 }),
    onda({ x0: xa, x1: xb, y: CY - 0.15, z: 0.6, color: '#2ee6f0', fase: 1.2, amp: 0.2 }),
  ];
  // Estacionaria con el vientre en el centro de la cavidad (donde el mapa de calor tiene su mancha central).
  const suma = onda({ x0: xa, x1: xb, y: CY + 0.15, z: 0.1, color: '#ffffff', modo: 1, amp: 0.22, grosor: 0.05, fase: Math.PI / 2 - K * CX });
  const brillo = (o, v, t, dur = 0.4) => tween(o.material.uniforms.brillo, { value: v }, { t, dur, ease: 'inOut' });

  // ---------- mapa de calor de la cavidad: solo brillan las manchas calientes; lo frío, un velo azul ----------
  const MAPA_Y = SUELO + 0.65;
  const mapa = new THREE.Mesh(new THREE.PlaneGeometry(CW - 0.1, CD - 0.1, 1, 1).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
    uniforms: { op: { value: 0 }, centro: { value: new THREE.Vector2(CX, 0) } },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `${CALOR} uniform float op; uniform vec2 centro; varying vec3 vW;
      void main(){ float c = calor(vW.xz - centro), cal = smoothstep(0.3, 0.9, c), fri = 1.0 - smoothstep(0.03, 0.25, c);
        vec3 col = mix(vec3(0.2, 0.42, 1.0), vec3(1.0, 0.22, 0.06) * (1.0 + 1.2 * cal), step(0.15, c));
        gl_FragColor = vec4(col, max(cal * 0.92, fri * 0.4) * op); }`,
    transparent: true, depthWrite: false,
  }));
  mapa.position.set(CX, MAPA_Y, 0); mapa.userData.sinSombra = true; MO.add(mapa);

  // ---------- tableta de chocolate, a lo largo (de delante a atrás), con manchas cada media onda ----------
  const choco = new THREE.Group(); choco.position.set(CX, SUELO + 0.1, 0); choco.visible = false; MO.add(choco);
  choco.add(new THREE.Mesh(geo.caja(1.2, 0.16, 2.8, 0.04), mat.pintado((g, w, h) => {
    g.fillStyle = '#3e2214'; g.fillRect(0, 0, w, h);
    const cw = w / 3, ch = h / 8;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 8; j++) {
      const x = i * cw, y = j * ch, gr = g.createLinearGradient(x, y, x + cw, y + ch);
      gr.addColorStop(0, '#6a3b22'); gr.addColorStop(1, '#40220f');
      g.fillStyle = gr; g.beginPath(); g.roundRect(x + 12, y + 12, cw - 24, ch - 24, 10); g.fill();
    }
  }, { w: 480, h: 1024, rugosidad: 0.5 })));
  const zsManchas = [-2, -1, 0, 1, 2].map(n => n * MEDIA);
  const manchas = zsManchas.map(z => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.27, 28, 12).scale(1, 0.08, 1), mat.plastico(0x5e2f16, 0.14));
    m.position.set(0, 0.09, z); m.scale.setScalar(0.001); choco.add(m);
    const h = halo(choco, { color: '#ff7a2e', tam: 0.75, opacidad: 0 }); h.position.set(0, 0.12, z);
    return { m, h };
  });
  const entra = { z: 3.4 };

  // ---------- agitador (microondas sin plato): pieza de metal que gira bajo el techo ----------
  const agitador = new THREE.Group(); agitador.position.set(CX, CY + CH / 2 - 0.15, 0); agitador.visible = false; tapa.add(agitador);
  for (let i = 0; i < 4; i++) {
    const pala = new THREE.Mesh(geo.caja(1.1, 0.03, 0.32, 0.02), mat.plastico(0xd2d6dc, 0.25)); pala.rotation.set(0.35, (i * Math.PI) / 2, 0); pala.translateX(0.55); agitador.add(pala);
  }
  agitador.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.12, 16), mat.plastico(0xd2d6dc, 0.25)));
  cada(T => { agitador.rotation.y = T * 2.2; });

  // vapor del remate: cada bocanada sube, crece y se desvanece
  const vaporOp = { v: 0 };
  const vapor = [0, 1, 2].map(i => { const v = halo(plato, { color: '#ffffff', tam: 1, opacidad: 0 }); v.position.set((i - 1) * 0.35, 0.8, 0); return v; });
  cada(T => vapor.forEach((v, i) => { const k = ((T * 0.45 + i / 3) % 1); v.position.y = 0.6 + k * 1.1; v.scale.setScalar(0.6 + k * 0.9); v.material.opacity = vaporOp.v * Math.sin(k * Math.PI); }));

  // ---------- coreografía ----------
  // 0. Encendido: luz y ondas viajeras tras el cristal.
  tween(luzIn, { intensity: 3.5 }, { t: 0.2, dur: 0.6, ease: 'sale' });
  ondas.forEach((o, i) => brillo(o, 1, 0.3 + i * 0.12));
  ui.cifra({ texto: '2.450 millones', unidad: 'por segundo', tam: 80, t: palabra(0, '2.450'), hasta: fin(0), x: 490, y: 1320 });
  // 1. Se abre la puerta: el plato girando.
  tween(bisagra.rotation, { y: -1.85 }, { t: f(1) - 0.1, dur: 1.0, ease: 'pesado' });
  // Giro del plato: arranca en la 1, se para en la 5 («si se quedara quieta»), sigue en la 6 y vuelve con el plato en la 13.
  const vel = t => {
    const r = (a, d = 0.5) => Math.min(1, Math.max(0, (t - a) / d));
    return 0.7 * (r(f(1)) - r(f(5), 0.4) + r(f(6) + 0.2) - r(palabra(7, 'quita'), 0.3) + r(f(13), 0.6));
  };
  const acumula = ctx.acumulado(vel);
  cada(T => { plato.rotation.y = acumula(T); });
  // 2. La tapa se levanta en corte: rebotan en el metal.
  tween(tapa.position, { y: 12 }, { t: f(2) - 0.3, dur: 1.1, ease: 'inOut' });
  ui.etiqueta('paredes de metal', { ancla: [CX - CW / 2, CY + 0.9, 0.6], offset: [0.1, 0, 0], color: '#ffd23f', t: palabra(2, 'metal'), hasta: fin(2) });
  // 3. Se suman y se anulan: la onda blanca estacionaria
  ondas.forEach(o => brillo(o, 0.22, f(3)));
  brillo(suma, 1, f(3));
  ui.etiqueta('se suman', { ancla: [CX, CY + 0.5, 0.1], offset: [0, 0.45, 0], color: '#ff4d5e', t: palabra(3, 'suman'), hasta: fin(3) });
  ui.etiqueta('se anulan', { ancla: [CX - MEDIA / 2, CY + 0.15, 0.1], offset: [0, -0.5, 0], color: '#4f7dff', t: palabra(3, 'anulan'), hasta: fin(3) });
  // 4. Mapa de calor desde arriba: manchas cada 6 cm
  ondas.forEach(o => brillo(o, 0, f(4))); brillo(suma, 0, f(4));
  tween(mapa.material.uniforms.op, { value: 1 }, { t: f(4), dur: 0.6, ease: 'sale' });
  ui.flecha({ desde: { ancla: [CX, MAPA_Y, 0] }, hacia: { ancla: [CX + MEDIA, MAPA_Y, 0] }, color: '#ffffff', grosor: 7, t: palabra(4, '6'), hasta: fin(4) });
  ui.etiqueta('6 cm', { ancla: [CX + MEDIA / 2, MAPA_Y, 0], offset: [0, 0, -0.3], color: '#ffffff', t: palabra(4, '6') + 0.1, hasta: fin(4), linea: false });
  // 5. Comida quieta: el mapa se le queda grabado (ardiendo y helado)
  tween(mapa.material.uniforms.op, { value: 0 }, { t: f(5), dur: 0.6, ease: 'inOut' });
  tween(comidaMat.uniforms.cocinado, { value: 1 }, { t: f(5) + 0.1, dur: 0.8, ease: 'sale' });
  ui.etiqueta('ardiendo', { ancla: [CX, SUELO + 0.56, 0], offset: [0, 0.35, -0.2], color: '#ff4d5e', t: palabra(5, 'ardiendo'), hasta: fin(5) });
  ui.etiqueta('helado', { ancla: [CX + MEDIA / 2, SUELO + 0.56, MEDIA / 2], offset: [0.35, 0.3, 0.35], color: '#4f7dff', t: palabra(5, 'helados'), hasta: fin(5) });
  // 6. Al girar, todo parejo
  tween(comidaMat.uniforms.parejo, { value: 1 }, { t: f(6) + 0.6, dur: fin(6) - f(6) - 0.7, ease: 'inOut' });
  ui.etiqueta('parejo', { ancla: [CX, SUELO + 0.56, 0], offset: [0, 0.4, -0.2], color: '#ffd23f', t: palabra(6, 'parejo'), hasta: fin(6) });
  // 7. Fuera el plato (sube y sale de cuadro) y entra la tableta por la puerta; en la 13 el plato vuelve desde delante.
  tween(mano, { quita: 1 }, { t: palabra(7, 'quita'), dur: 1.0, ease: 'inOut' });
  const tMete = palabra(7, 'quita') + 0.35;
  tween(entra, { z: 0 }, { t: tMete, dur: 0.9, ease: 'pesado' });
  tween(mano, { vuelve: 1 }, { t: f(13) - 0.2, dur: 0.9, ease: 'pesado' });
  cada(T => {
    if (T < f(12)) { plato.position.set(CX, SUELO + 0.12 + mano.quita * 6, 0); plato.visible = mano.quita < 0.98; }
    else { plato.position.set(CX, SUELO + 0.12, (1 - mano.vuelve) * 2.5); plato.visible = mano.vuelve > 0.02; }
    choco.visible = T >= tMete - 0.05 && T < f(12) - 0.1; choco.position.z = entra.z;
  });
  // 8. Manchas derretidas cada media onda
  manchas.forEach(({ m, h }, i) => {
    const t = palabra(8, 'manchas') + i * 0.14;
    tween(m.scale, { x: 1, y: 1, z: 1 }, { t, dur: 0.6, ease: 'rapido' });
    tween(h.material, { opacity: 0.75 }, { t, dur: 0.3, ease: 'sale' });
    tween(h.material, { opacity: 0.15 }, { t: t + 0.6, dur: 0.8, ease: 'inOut' });
    // en «luz» vuelven a encenderse en fila: de esas manchas sale la velocidad de la luz
    tween(h.material, { opacity: 0.8 }, { t: palabra(10, 'luz') + i * 0.08, dur: 0.2, ease: 'sale' });
    tween(h.material, { opacity: 0.15 }, { t: palabra(10, 'luz') + 0.4 + i * 0.08, dur: 0.6, ease: 'inOut' });
  });
  // 9. Medir: 6,1 cm × 2 × 2.450 MHz
  ui.flecha({ desde: { ancla: [CX + 0.42, SUELO + 0.3, zsManchas[2]] }, hacia: { ancla: [CX + 0.42, SUELO + 0.3, zsManchas[3]] }, color: '#ffd23f', grosor: 7, t: f(9), hasta: fin(9) });
  ui.etiqueta('6,1 cm', { ancla: [CX + 0.42, SUELO + 0.3, MEDIA / 2], offset: [0.55, 0, 0], color: '#ffd23f', t: f(9) + 0.1, hasta: fin(9), linea: false });
  ui.tarjeta({ titulo: 'La cuenta', valor: '6,1 cm × 2 × 2.450 MHz', acento: '#ffd23f', t: palabra(9, 'frecuencia') - 0.4, hasta: fin(9), y: 1330 });
  // 10. La velocidad de la luz
  ui.cifra({ texto: t => `${(Math.round(299 * Math.min(1, Math.max(0, (t - f(10)) / 1.1))) * 1000).toLocaleString('es-ES')}`, unidad: 'km/s', tam: 120, t: f(10), hasta: fin(11), y: 1300 });
  ui.etiqueta('velocidad de la luz', { x: 540, y: 1170, color: '#ffffff', t: palabra(10, 'luz') - 0.1, hasta: fin(11), quieto: true });
  // 11. Plano de cocina: la tapa vuelve a su sitio
  tween(tapa.position, { y: 0 }, { t: f(11) - 0.2, dur: 1.2, ease: 'inOut' });
  // 12. Sin plato: el agitador remueve las ondas bajo el techo
  cada(T => { agitador.visible = T >= f(11) && T < f(13) + 0.6; });
  ondas.forEach((o, i) => { brillo(o, 0.8, f(12) + i * 0.1); brillo(o, 0, fin(12) - 0.3); });
  tween(luzIn, { intensity: 6 }, { t: f(12), dur: 0.5, ease: 'sale' });
  tween(luzIn, { intensity: 3.5 }, { t: fin(12), dur: 0.5, ease: 'inOut' });
  ui.etiqueta('pieza de metal que gira', { ancla: [CX + 0.5, CY + CH / 2 - 0.2, 0.3], offset: [0, -0.6, 0.4], color: '#ffd23f', t: palabra(12, 'metal'), hasta: fin(12) });
  // 13. Remate: el plato vuelve, gira y la tortilla humea pareja
  tween(vaporOp, { v: 0.55 }, { t: f(13) + 0.5, dur: 0.8, ease: 'sale' });
  // 14. Compartir
  ui.compartir({ previa: '¿Por qué gira el plato del microondas? 🍫', nombres: ['Laura', 'Dani', 'Sergio'], t: palabra(14, 'adivina') - 0.4, hasta: fin(14) + 1 });

  // ---------- director de cámara: un encuadre por frase, fundido de 1,1 s ----------
  const P = (pos, mira, fov = 40) => ({ pos, mira, fov });
  const planos = [
    P([1.4, 2.2, 9.0], [-0.4, 1.5, 0], 40),                        // 0 frontal, luz y ondas tras el cristal
    P([CX + 0.9, 2.5, 5.6], [CX, SUELO + 0.5, 0], 38),              // 1 puerta abierta: el plato girando
    P([1.4, 3.4, 5.4], [CX, CY + 0.1, 0], 40),                      // 2 corte: ondas rebotando
    P([0.0, 2.2, 4.8], [CX, CY + 0.2, 0], 42),                      // 3 la onda que se suma y se anula
    P([CX + 0.2, 8.4, 3.0], [CX, MAPA_Y, -0.1], 36),                // 4 desde arriba: el mapa de calor
    P([CX + 0.5, 5.8, 3.2], [CX, SUELO + 0.4, 0], 34),              // 5 la tortilla a manchas
    P([CX + 1.6, 4.4, 4.0], [CX, SUELO + 0.4, 0], 40),              // 6 gira y se iguala
    P([CX + 1.0, 4.2, 5.6], [CX, SUELO + 0.3, 0.6], 40),            // 7 sale el plato, cae el chocolate
    P([CX + 0.3, 7.6, 3.4], [CX, SUELO, 0], 36),                    // 8 manchas, desde arriba
    P([CX + 0.7, 6.6, 3.0], [CX + 0.3, SUELO, 0.2], 36),           // 9 la regla
    P([CX + 1.4, 5.0, 4.8], [CX, SUELO, 0.2], 40),                  // 10 la luz
    P([-0.1, 4.0, 9.5], [-0.5, 0.6, 0], 40),                        // 11 el microondas en la cocina
    P([CX + 0.8, 1.0, 4.6], [CX, CY + 0.6, 0], 42),                 // 12 el agitador bajo el techo
    P([CX + 1.2, 3.4, 4.6], [CX, SUELO + 0.5, 0], 38),              // 13 el plato humeante
    P([3.0, 2.8, 9.0], [-0.3, 1.6, 0], 40),                         // 14 compartir, microondas detrás
  ];
  // Cada plano se acerca despacio (3 % por segundo, hasta un 12 %) para que la cámara nunca esté parada.
  // La primera frase entra hacia el cristal más rápido (gancho): hasta un 25 %.
  const pose = (i, T) => { const p = planos[i], e = 1 - Math.min(i ? 0.12 : 0.25, Math.max(0, T - f(i)) * (i ? 0.03 : 0.1)); return { ...p, pos: p.pos.map((v, j) => p.mira[j] + (v - p.mira[j]) * e) }; };
  const fraseEn = T => { let i = 0; while (i + 1 < frases.length && T >= frases[i + 1].inicio) i++; return i; };
  const suave = p => p * p * (3 - 2 * p), mezcla = (a, b, k) => a.map((v, j) => v + (b[j] - v) * k);
  cada(T => {
    const i = fraseEn(T), a = pose(i, T), k = suave(Math.min(1, (T - f(i)) / 1.1));
    const b = i === 0 || k >= 1 ? a : pose(i - 1, f(i));
    camara.poner({ pos: mezcla(b.pos, a.pos, k), mira: mezcla(b.mira, a.mira, k), fov: b.fov + (a.fov - b.fov) * k });
  });
  sombras({ centro: [0, 1, 0], tam: 6 });
  camara.deriva(0.5);
  tween(dof, { apertura: 1.2 }, { t: f(14), dur: 0.8, ease: 'inOut' });
}
