// Renderiza el motor fotograma a fotograma con Chromium (WebGL por software) y lo codifica con ffmpeg.
// Uso: node pipeline/render.cjs <timeline.json> <audio.wav> <salida.mp4>
//      node pipeline/render.cjs <timeline.json> --previa <salida.jpg>   (un fotograma a mitad de cada frase, en mosaico)
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const FPS = 30;
const RAIZ = path.join(__dirname, '..');
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg' };
const [, , rutaTimeline, arg2, arg3] = process.argv;

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

(async () => {
  const timeline = JSON.parse(fs.readFileSync(rutaTimeline, 'utf8'));
  const srv = await servidor();
  const navegador = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const pagina = await navegador.newPage({ viewport: { width: 1080, height: 1920 } });
  pagina.on('console', m => { if (['error', 'warning'].includes(m.type())) console.log(`[navegador] ${m.text()}`); });
  pagina.on('pageerror', e => console.log(`[error en la escena] ${e.message}`));
  await pagina.goto(`http://127.0.0.1:${srv.address().port}/pipeline/motor/index.html`);
  await pagina.waitForFunction(() => window.motorListo, null, { timeout: 30000 });
  await pagina.evaluate(d => window.iniciar(d), timeline);

  if (arg2 === '--previa') {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'previa-'));
    const tiempos = timeline.frases.map(f => (f.inicio + f.fin) / 2);
    for (const [i, t] of tiempos.entries()) {
      await pagina.evaluate(t => window.pintar(t), t);
      await pagina.screenshot({ type: 'jpeg', quality: 85, path: path.join(dir, `${String(i).padStart(2, '0')}.jpg`) });
    }
    const cols = Math.min(5, tiempos.length), filas = Math.ceil(tiempos.length / cols);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '1', '-i', path.join(dir, '%02d.jpg'),
      '-vf', `scale=324:576,tile=${cols}x${filas}:padding=6:color=0x333333`, '-frames:v', '1', arg3]);
    console.log(`Previa: ${arg3} (${tiempos.length} frases)`);
  } else {
    const ffmpeg = spawn('ffmpeg', [
      '-y', '-loglevel', 'error',
      '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-i', arg2, '-map', '0:v', '-map', '1:a',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(FPS),
      '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', arg3,
    ], { stdio: ['pipe', 'inherit', 'inherit'] });
    const terminado = new Promise((ok, ko) => ffmpeg.on('close', c => (c === 0 ? ok() : ko(new Error(`ffmpeg salió con ${c}`)))));
    const total = Math.ceil(timeline.duracion * FPS), t0 = Date.now();
    for (let f = 0; f < total; f++) {
      await pagina.evaluate(t => window.pintar(t), f / FPS);
      const jpg = await pagina.screenshot({ type: 'jpeg', quality: 92 });
      if (!ffmpeg.stdin.write(jpg)) await new Promise(r => ffmpeg.stdin.once('drain', r));
      if (f % 150 === 0) console.log(`  fotograma ${f}/${total} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    }
    ffmpeg.stdin.end();
    await terminado;
  }
  await navegador.close();
  srv.close();
})().catch(e => { console.error(e); process.exit(1); });
