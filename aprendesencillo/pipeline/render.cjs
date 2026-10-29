// Renderiza el motor fotograma a fotograma con Chromium (WebGL por software) y lo codifica con ffmpeg.
// Uso: node pipeline/render.cjs <timeline.json> <audio.wav> <salida.mp4>
//      node pipeline/render.cjs <timeline.json> --previa <salida.jpg>   (un fotograma a mitad de cada frase, en mosaico)
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const FPS = 60;
const RAIZ = path.join(__dirname, '..');
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg' };
const [, , rutaTimeline, arg2, arg3] = process.argv;

// Presupuesto de render. Con WebGL por software el coste depende de la escena: si va a tardar más de LIMITE_MIN,
// el 3D se pinta a menos resolución (los textos siguen nítidos) para quedarse cerca de OBJETIVO_MIN.
const LIMITE_MIN = 48, OBJETIVO_MIN = 42, ESCALA = 0.75, ESCALA_MIN = 0.5;
// Con tarjeta gráfica de verdad (un Mac, o APRENDE_GPU=1) no hay que ahorrar: 3D a resolución completa y MSAA 4×.
const GPU = process.platform === 'darwin' || process.env.APRENDE_GPU === '1';
const ARGS = GPU ? ['--use-angle=' + (process.platform === 'darwin' ? 'metal' : 'default'), '--enable-gpu', '--ignore-gpu-blocklist']
                 : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const SALTO = 35;   // diferencia media a partir de la cual hay salto: movimiento continuo 2-17, barrido rápido 26-30, corte 48-89
const FIJO = 0.15;   // s por fotograma que no dependen de la resolución del 3D (captura y textos); medido en marcha-atras-120

// Efectos de sonido sintetizados con ffmpeg (sin archivos de audio de terceros). nivel = volumen bajo la voz.
const EFECTOS = {
  whoosh: { nivel: 0.9, gen: d => ['-f', 'lavfi', '-i', `anoisesrc=d=${d}:c=pink:a=0.6`, '-af', `highpass=f=250,lowpass=f=3200,afade=t=in:st=0:d=${(d * 0.45).toFixed(2)},afade=t=out:st=${(d * 0.45).toFixed(2)}:d=${(d * 0.55).toFixed(2)}`] },
  pop: { nivel: 0.25, gen: () => ['-f', 'lavfi', '-i', "aevalsrc='0.7*sin(2*PI*(480+900*exp(-25*t))*t)*exp(-22*t)':d=0.18"] },
  clic: { nivel: 0.35, gen: () => ['-f', 'lavfi', '-i', "aevalsrc='0.8*(random(0)*2-1)*exp(-250*t)+0.4*sin(2*PI*3000*t)*exp(-120*t)':d=0.05", '-af', 'highpass=f=1500'] },
  // El golpe vive entre 100 y 300 Hz con un chasquido encima: por debajo de ~120 Hz los altavoces del móvil no suenan.
  golpe: { nivel: 0.5, gen: () => ['-f', 'lavfi', '-i', "aevalsrc='0.7*sin(2*PI*(100+170*exp(-20*t))*t)*exp(-6*t)+0.3*sin(2*PI*210*t)*exp(-10*t)+0.45*(random(0)*2-1)*exp(-35*t)':d=0.7", '-af', 'lowpass=f=5000'] },
  chispas: { nivel: 0.3, gen: d => ['-f', 'lavfi', '-i', `aevalsrc='0.9*(random(0)*2-1)*gt(random(1),0.996)':d=${d}`, '-af', `highpass=f=1800,lowpass=f=9000,afade=t=out:st=${Math.max(0, d - 0.3).toFixed(2)}:d=0.3`] },
};

function mezclarSonido(eventos, voz, destino, dir) {
  const archivos = {}, entradas = ['-i', voz], filtros = [];
  eventos.filter(e => EFECTOS[e.tipo]).slice(0, 90).forEach((e, i) => {
    const d = Math.max(0.2, Math.round((e.dur || 0.8) * 10) / 10), clave = `${e.tipo}-${d}`;
    if (!archivos[clave]) {
      archivos[clave] = path.join(dir, `${clave}.wav`);
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...EFECTOS[e.tipo].gen(d), '-ar', '48000', '-ac', '1', archivos[clave]]);
    }
    entradas.push('-i', archivos[clave]);
    const ms = Math.round(e.t * 1000 + 1000 / FPS);   // el sonido llega un fotograma después de la imagen, como en la vida real
    filtros.push(`[${i + 1}]adelay=${ms}|${ms},volume=${(EFECTOS[e.tipo].nivel * (e.vol ?? 1)).toFixed(3)}[s${i}]`);
  });
  if (!filtros.length) return voz;
  const n = filtros.length;
  filtros.push(`[0]${Array.from({ length: n }, (_, i) => `[s${i}]`).join('')}amix=inputs=${n + 1}:normalize=0:duration=first,alimiter=limit=0.95[a]`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...entradas, '-filter_complex', filtros.join(';'), '-map', '[a]', '-ar', '48000', destino]);
  console.log(`  sonido: ${n} efectos mezclados con la voz`);
  return destino;
}

function servidor() {
  return new Promise(ok => {
    const srv = http.createServer((pet, res) => {
      const ruta = path.normalize(path.join(RAIZ, decodeURIComponent(pet.url.split('?')[0])));
      if (!ruta.startsWith(RAIZ)) { res.writeHead(403); return res.end(); }
      fs.readFile(ruta, (err, datos) => {
        if (err) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { 'Content-Type': TIPOS[path.extname(ruta)] || 'application/octet-stream' }); res.end(datos);
      });
    }).listen(0, '127.0.0.1', () => ok(srv));
  });
}

async function abrir(navegador, puerto, timeline) {
  const pagina = await navegador.newPage({ viewport: { width: 1080, height: 1920 } });
  pagina.on('console', m => { if (['error', 'warning'].includes(m.type())) console.log(`[navegador] ${m.text()}`); });
  pagina.on('pageerror', e => console.log(`[error en la escena] ${e.message}`));
  await pagina.goto(`http://127.0.0.1:${puerto}/pipeline/motor/index.html`);
  await pagina.waitForFunction(() => window.motorListo, null, { timeout: 30000 });
  await pagina.evaluate(d => window.iniciar(d), timeline);
  pagina.cdp = await pagina.context().newCDPSession(pagina);   // captura directa por CDP: más rápida que page.screenshot
  return pagina;
}

// La GPU por software trabaja al capturar, así que se mide pintar + captura.
async function captura(pagina, t, { calidad = 94, ruta } = {}) {
  const a = Date.now();
  await pagina.evaluate(t => window.pintar(t), t);
  const { data } = await pagina.cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: calidad, optimizeForSpeed: true });
  const jpg = Buffer.from(data, 'base64');
  if (ruta) fs.writeFileSync(ruta, jpg);
  return { jpg, s: (Date.now() - a) / 1000 };
}
// Segundos por fotograma en t, en una segunda pasada para no contar la compilación de shaders de lo que aparece por primera vez.
const coste = async (pagina, t) => { await captura(pagina, t); return (await captura(pagina, t)).s; };
// Minutos de render: el coste a mitad de cada frase, ponderado por lo que dura la frase.
const estimar = (timeline, costes) => timeline.frases.reduce((s, f, i) => s + costes[i] * (f.fin - f.inicio) * FPS, 0) / 60;

(async () => {
  const timeline = JSON.parse(fs.readFileSync(rutaTimeline, 'utf8'));
  if (GPU) { timeline.escala ??= 1; timeline.muestras ??= 4; console.log('  render con GPU: 3D al 100 % y MSAA 4×'); }
  const srv = await servidor(), puerto = srv.address().port;
  const navegador = await chromium.launch({ args: ARGS });
  let pagina = await abrir(navegador, puerto, timeline);
  const gpu = await pagina.evaluate(() => { const gl = document.createElement('canvas').getContext('webgl2'), x = gl?.getExtension('WEBGL_debug_renderer_info'); return x ? gl.getParameter(x.UNMASKED_RENDERER_WEBGL) : 'desconocida'; });
  console.log(`  WebGL: ${gpu}`);

  if (arg2 === '--previa') {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'previa-'));
    const tiempos = timeline.frases.map(f => (f.inicio + f.fin) / 2), costes = [], lineas = [], maqueta = [];
    for (const [i, t] of tiempos.entries()) {
      await captura(pagina, t, { calidad: 85, ruta: path.join(dir, `${String(i).padStart(2, '0')}.jpg`) });
      const st = await pagina.evaluate(() => window.estadisticas());
      for (const a of await pagina.evaluate(() => window.maquetacion())) maqueta.push(`    frase ${String(i).padStart(2)}: ${a}`);
      costes.push((await captura(pagina, t)).s);
      lineas.push(`    frase ${String(i).padStart(2)}: ${costes[i].toFixed(2)} s/fotograma · ${st.mallas} mallas (${st.sombras} con sombra) · ${Math.round(st.tri / 1000)} mil triángulos · ${st.luces} luces (${st.lucesSombra} pasadas de sombra)${costes[i] > 0.85 ? '  ← PESADA' : ''}`);
    }
    // Copia de cada fotograma suelto (para mirarlos a tamaño real y medirlos en make.py).
    const sueltos = arg3.replace(/\.jpg$/, '');
    fs.rmSync(sueltos, { recursive: true, force: true }); fs.mkdirSync(sueltos, { recursive: true });
    for (const f of fs.readdirSync(dir)) fs.copyFileSync(path.join(dir, f), path.join(sueltos, f));
    const cols = Math.min(5, tiempos.length), filas = Math.ceil(tiempos.length / cols);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '1', '-i', path.join(dir, '%02d.jpg'),
      '-vf', `scale=324:576,tile=${cols}x${filas}:padding=6:color=0x333333`, '-frames:v', '1', arg3]);
    console.log(`Previa: ${arg3} (${tiempos.length} frases)`);
    // Cada anotación, revisada en el momento en que aparece (las que salen después de la mitad de la frase no estaban en la foto).
    const fraseDe = t => Math.max(0, timeline.frases.findIndex(f => t >= f.inicio && t < f.fin));
    for (const t of await pagina.evaluate(() => window.momentosAnotaciones())) {
      for (const a of await pagina.evaluate(t => window.maquetacionEn(t), t)) maqueta.push(`    frase ${String(fraseDe(t)).padStart(2)}: ${a}`);
    }
    maqueta.splice(0, maqueta.length, ...new Set(maqueta));
    // Saltos: diferencia media (0-255) en la zona principal entre el fotograma anterior y el siguiente a cada cambio de frase.
    // A 60 fps, un movimiento continuo cambia poco de un fotograma al otro; un corte o una pieza que aparece de golpe, mucho.
    const saltos = [];
    for (const [i, f] of timeline.frases.entries()) {
      if (!i) continue;
      const a = path.join(dir, 'antes.jpg'), b = path.join(dir, 'despues.jpg');
      await captura(pagina, f.inicio - 1 / FPS, { calidad: 85, ruta: a }); await captura(pagina, f.inicio + 1 / FPS, { calidad: 85, ruta: b });
      const sal = execFileSync('ffmpeg', ['-v', 'error', '-i', a, '-i', b, '-filter_complex',
        '[0]crop=1080:980:0:460,format=gray[x];[1]crop=1080:980:0:460,format=gray[y];[x][y]blend=all_mode=difference,signalstats,metadata=mode=print:key=lavfi.signalstats.YAVG:file=-',
        '-f', 'null', '-']).toString();
      const d = parseFloat((sal.match(/YAVG=([\d.]+)/) || [])[1] || 0);
      if (d > SALTO) saltos.push(`    frase ${String(i).padStart(2)}: ${d.toFixed(1)}  ← SALTO al empezar «${f.texto.slice(0, 40)}»`);
    }
    fs.rmSync(path.join(dir, 'antes.jpg'), { force: true }); fs.rmSync(path.join(dir, 'despues.jpg'), { force: true });
    const est = estimar(timeline, costes);
    console.log(`  transiciones (a 60 fps todo cambio de plano debe ser un movimiento, no un corte):\n${saltos.length ? saltos.join('\n') : '    sin saltos bruscos'}`);
    console.log(`  maquetación (las anotaciones de texto ya se apartan solas; esto es lo que no se pudo resolver):\n${maqueta.length ? maqueta.join('\n') : '    sin problemas'}`);
    console.log(`  coste de render (objetivo: todas por debajo de 0,85 s/fotograma):\n${lineas.join('\n')}`);
    console.log(`  render estimado: ${Math.round(est)} min` + (est > LIMITE_MIN
      ? ` → DEMASIADO: el render bajaría la resolución del 3D. Aligera las frases PESADAS (menos luces con sombra: cada PointLight con sombra pinta la escena 6 veces; InstancedMesh para piezas repetidas; menos segmentos; quita lo que no se ve).`
      : ''));
  } else {
    if (timeline.escala == null) {
      const costes = [];
      for (const f of timeline.frases) costes.push(await coste(pagina, (f.inicio + f.fin) / 2));
      const est = estimar(timeline, costes), fotogramas = timeline.duracion * FPS;
      if (est > LIMITE_MIN) {
        const medio = est * 60 / fotogramas, objetivo = OBJETIVO_MIN * 60 / fotogramas;
        const escala = Math.max(ESCALA_MIN, Math.round(100 * ESCALA * Math.sqrt(Math.max(0, objetivo - FIJO) / (medio - FIJO))) / 100);
        console.log(`  render estimado ${Math.round(est)} min: el 3D se pinta al ${Math.round(escala * 100)} % en vez del ${ESCALA * 100} % para no pasar de ~${OBJETIVO_MIN} min`);
        await pagina.close();
        pagina = await abrir(navegador, puerto, { ...timeline, escala });
      } else console.log(`  render estimado: ${Math.round(est)} min`);
    }
    const dirSonido = fs.mkdtempSync(path.join(os.tmpdir(), 'sonido-'));
    const audio = mezclarSonido(await pagina.evaluate(() => window.sonidos()), arg2, path.join(dirSonido, 'mezcla.wav'), dirSonido);
    const ffmpeg = spawn('ffmpeg', [
      '-y', '-loglevel', 'error',
      '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-i', audio, '-map', '0:v', '-map', '1:a',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-maxrate', '5500k', '-bufsize', '11000k', '-profile:v', 'high', '-level', '4.2', '-pix_fmt', 'yuv420p', '-r', String(FPS),
      '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', arg3,
    ], { stdio: ['pipe', 'inherit', 'inherit'] });
    const terminado = new Promise((ok, ko) => ffmpeg.on('close', c => (c === 0 ? ok() : ko(new Error(`ffmpeg salió con ${c}`)))));
    const total = Math.ceil(timeline.duracion * FPS), t0 = Date.now();
    for (let f = 0; f < total; f++) {
      const { jpg } = await captura(pagina, f / FPS);
      if (!ffmpeg.stdin.write(jpg)) await new Promise(r => ffmpeg.stdin.once('drain', r));
      if (f % 150 === 0) {
        const s = (Date.now() - t0) / 1000;
        console.log(`  fotograma ${f}/${total} (${s.toFixed(0)} s${f ? `, faltan ~${Math.round(s / f * (total - f) / 60)} min` : ''})`);
      }
    }
    ffmpeg.stdin.end();
    await terminado;
  }
  await navegador.close();
  srv.close();
})().catch(e => { console.error(e); process.exit(1); });
