// Renderiza la plantilla fotograma a fotograma con Chromium y la codifica con ffmpeg.
// Uso: node pipeline/render.cjs <timeline.json> <audio.wav> <salida.mp4>
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const FPS = 30;
const [, , rutaTimeline, rutaAudio, rutaSalida] = process.argv;

(async () => {
  const timeline = JSON.parse(fs.readFileSync(rutaTimeline, 'utf8'));
  const navegador = await chromium.launch();
  const pagina = await navegador.newPage({ viewport: { width: 1080, height: 1920 } });
  await pagina.goto('file://' + path.join(__dirname, 'plantilla.html'));
  await pagina.evaluate(d => window.iniciar(d), timeline);
  await pagina.evaluate(() => document.fonts.ready);

  const ffmpeg = spawn('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-i', rutaAudio,
    '-map', '0:v', '-map', '1:a',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart',
    rutaSalida,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const terminado = new Promise((ok, ko) => ffmpeg.on('close', c => (c === 0 ? ok() : ko(new Error(`ffmpeg salió con ${c}`)))));

  const total = Math.ceil(timeline.duracion * FPS);
  for (let f = 0; f < total; f++) {
    await pagina.evaluate(t => window.pintar(t), f / FPS);
    const jpg = await pagina.screenshot({ type: 'jpeg', quality: 92 });
    if (!ffmpeg.stdin.write(jpg)) await new Promise(r => ffmpeg.stdin.once('drain', r));
    if (f % 300 === 0) console.log(`  fotograma ${f}/${total}`);
  }
  ffmpeg.stdin.end();
  await terminado;
  await navegador.close();
})().catch(e => { console.error(e); process.exit(1); });
