# Sesión programada de @aprendesencillo

Hay dos sesiones al día: **turno 0** (mañana) y **turno 1** (tarde). El mensaje que te lanza dice cuál eres. Cada una deja en el Telegram de Yeyo **un** TikTok de 1 minuto, listo para publicar en la hora punta siguiente.

Cada vídeo es una explicación animada **hecha a medida**: un modelo 3D del objeto o del concepto que cambia en cada frase, con anotaciones precisas y subtítulos arriba. No explores el repo: lee solo lo que se indica aquí.

## Pasos

0. Comprueba que existen `ELEVENLABS_API_KEY` y `TELEGRAM_BOT_TOKEN`. Si falta alguna, para aquí y termina diciendo cuál falta: sin ellas no hay voz buena ni forma de entregar el vídeo. `TELEGRAM_CHAT_ID` es opcional: si no está, `enviar.py` lo descubre solo y le dice a Yeyo cuál es.
1. `cd aprendesencillo && python3 pipeline/siguiente.py --turno <N>` → tu tema (`id | pregunta | pista`).
2. Mira `referencia/marcha-atras-120-previa.jpg` (el listón de calidad) y lee `escenas/marcha-atras-120.js` y `guiones/marcha-atras-120.json`: son el ejemplo del estilo, del nivel de detalle y de la API (ese dura 40 s; los tuyos, 1 minuto).
3. **Plano de rodaje antes de programar:** en el propio `guiones/<id>.json` añade `"planos"`, una línea por frase: qué enseña la cámara, qué se mueve y qué anotación aparece. Comprueba que cada frase tiene un cambio visual claro y que hay un "momento" fuerte cada 3-5 s. Después escribe `escenas/<id>.js` siguiendo ese plan.
4. **Bucle de crítica** (aquí se gana o se pierde el vídeo):
   1. Saca la previa: `python3 pipeline/make.py guiones/<id>.json --previa` (unos 30 s; la voz queda en caché y no se vuelve a gastar).
   2. Mira `out/<id>-previa.jpg` (un fotograma a mitad de cada frase) al lado de `referencia/marcha-atras-120-previa.jpg`. Los fotogramas sueltos, a tamaño real, están en `out/<id>-previa/NN.jpg`: ábrelos cuando dudes de un detalle. La previa también imprime una **medición** por frase; si alguna sale `CASI VACÍO` o `MUY CLARO`, ese plano está mal aunque a simple vista parezca correcto.
   3. Puntúa cada fotograma del 1 al 10 en cuatro cosas:
      - **acabado**: texturas y detalle, nada que parezca de juguete;
      - **composición**: el objeto llena el cuadro y no hay solapes ni nada cortado sin querer;
      - **claridad**: se entiende la idea de esa frase sin audio;
      - **legibilidad**: subtítulos y anotaciones se leen bien.
   4. Escribe los 3 peores problemas, arréglalos y repite.
   5. Para cuando todo esté en 8 o más, o tras 3 rondas.
5. Render y envío (unos 30 min para 1 minuto de vídeo): lánzalo **en segundo plano** y espera a que acabe:
   `python3 pipeline/make.py guiones/<id>.json && python3 pipeline/enviar.py out/<id>.mp4`
6. Si algo falla y no lo arreglas en un intento: `python3 pipeline/enviar.py --aviso "<qué ha fallado>"`. Si el paso 1 imprimió `AVISO`, mándalo igual.

No hagas commits, push ni PRs: el tema sale de la fecha y no hay estado que guardar.

## Guion (`guiones/<id>.json`)

`{ "id", "frases": [...], "caption", "hashtags" }`. Temas curiosos explicados como en las referencias:

- **Gancho** (frase 1): una pregunta que parece tonta o una creencia común. Frase 2: giro inmediato ("No, no está roto.", "Spoiler: no entra.").
- **Explicación paso a paso**: una idea por frase, como máximo 14 palabras. Cada frase es un cambio en pantalla.
- **Un segundo giro a mitad** (un dato que nadie espera, o "y aquí viene lo bueno") para que no se vayan antes del final.
- **Remate**: la conclusión en una frase redonda ("Así que sí, está suelto, pero a propósito.").
- **Cierre para compartir**: "Envíaselo a ese amigo que…" con algo concreto y gracioso. Varía la fórmula.
- **Duración**: 55-65 s, que con esta voz son 130-150 palabras en 14-17 frases. Español de España, tono de colega.
- Marca con `*asteriscos*` las palabras clave: salen en blanco y en negrita; el resto, en gris.
- Escribe los números con cifras ("120", "4.000 rpm").
- **Datos**: solo lo bien establecido, partiendo de la `pista`. Para completar el minuto puedes hacer hasta 3 búsquedas web y confirmar cada cifra que añadas. Si dudas de algo, quítalo. Nunca inventes estudios, récords ni porcentajes. Nada de consejos médicos o financieros, ni política.

## Escena (`escenas/<id>.js`)

`export default function crear(ctx) { ... }`. Montas el 3D y programas todo con tiempos sacados de la voz. El motor usa **three.js r170** (está en `pipeline/motor/vendor/`): usa solo API de esa versión, y si dudas de si existe una clase o propiedad, búscala con `grep` en `vendor/three/three.module.min.js` antes de usarla. **Todo debe ser función del tiempo**: nada de `Math.random`, `Date` ni `requestAnimationFrame`; para azar, `ctx.azar(semilla)`.

**Tiempos**: `f(i)` inicio de la frase i, `fin(i)` su final, `palabra(i, 'texto')` cuándo se dice esa palabra dentro de la frase i (para sincronizar golpes exactos).

**Animación**:

| función | uso |
|---|---|
| `tween(obj, {prop: valor}, {t, dur, ease})` | anima números (`mesh.position`, `mesh.rotation`, `material`…). Curvas: `inOut`, `sale`, `entra`, `rebote`, `lineal`. **Muelles** (movimiento con masa; `dur` = lo que tarda en asentarse): `pesado` (objetos 3D grandes, sin pasarse), `muelle` (por defecto, se pasa un pelo), `rapido` (piezas pequeñas, botones), `jugueton` (rebote visible). Usa muelles para casi todo lo que se mueve; si el objetivo cambia varias veces, los muelles se encadenan sin saltos |
| `color(material.color, 0xff4d5e, {t, dur})` | cambia de color |
| `cada(t => …)` | lógica continua (giros, parpadeos) |
| `acumulado(t => velocidad)` | ángulo integrado cuando la velocidad cambia |
| `camara.poner({pos, mira, fov})` / `camara.ir({pos, mira, fov}, {t, dur})` | cámara. Con fov 38, el ancho visible es ≈ 0,39 × distancia |
| `fondo.ponerBrillo(hex, a)` / `fondo.brillo(hex, {t, dur, a})` | color del resplandor del fondo |

**3D** (esto es lo que marca la diferencia: tiene que parecer un render de producto, no un dibujo):
- `THREE` completo y `escena`.
- Materiales: `mat.metal(color, rugosidad)` (cepillado), `mat.metalPulido()`, `mat.oro()`, `mat.laton()`, `mat.plastico(color, rugosidad)`, `mat.goma()`, `mat.vidrio(color, opacidad)`, `mat.emisivo(color)`, `mat.madera(rx, ry)`, `mat.hormigon(rx, ry)` y `mat.pintado((ctx2d, w, h) => …)` para rótulos, escalas, pantallas, patrones o placas.
- Geometrías: `geo.caja(w, h, d, radio)` (redondeada), `geo.extruir(shape, grosor, bisel)`, `geo.torno([[radio, altura], …])` (pomos, botellas, latas, bombillas), `geo.engranaje(dientes, radio, grosor, {aligerado, sinDiente})`, `geo.diente(...)`, `geo.ejeEstriado(radio, largo)`, y cualquier primitiva de THREE.
- Ayudantes: `bordes(malla, {color})` (aristas iluminadas, para cristales y piezas fantasma), `halo(obj, {color, tam})` (resplandor; anima `halo.material.opacity`), `suelo({y})` (recibe sombras), `sombras({centro, tam})` (zona que cubre la luz que da sombra; si la escena salta de sitio, llámalo dentro de `cada`).
- Profundidad de campo: enfoca solo el punto al que mira la cámara. `dof.apertura` (1 suave, 2,5 macro) y `dof.foco` (0 = automático). Anímalo con `tween(dof, …)`.
- Calidad mínima:
  - **Nunca modeles personas ni animales enteros** con cápsulas y esferas: quedan como muñecos de plastilina y hunden el vídeo. Si el tema va de una persona o un animal, cuéntalo con **objetos** reconocibles (un casco, un reloj, un termómetro, una herramienta, la pieza concreta), con un esquema de cristal con aristas iluminadas (`mat.vidrio` + `bordes`) o con cifras y anotaciones; como mucho una parte (una mano, un ojo), nunca un cuerpo entero.
  - Modela el objeto real con sus detalles (biseles, tornillos, estrías, rótulos, texturas), no un bloque genérico.
  - El render siempre sale en vertical 1080×1920: no toques `pipeline/`.
  - Planos macro: el objeto llena el ancho y puede salirse un poco del cuadro.
  - Fondo oscuro: nada de planos grandes y claros detrás, porque lavan la imagen y se dejan de leer los subtítulos.
  - Transiciones con cámara en movimiento continuo (bajar al interior, barrido lateral), no cortes.

**Anotaciones** (HTML encima del 3D). Todas aceptan `t`, `hasta` (por defecto, el final de la frase), y una posición: `ancla` (un objeto 3D o `[x,y,z]`) con `offset`, o `x`/`y` en píxeles (lienzo de 1080×1920).

| función | qué es |
|---|---|
| `ui.numero({texto, unidad, tam})` | cifra gigante en monoespaciada con dígitos de colores; `texto` puede ser `t => …` para un contador |
| `ui.etiqueta(texto, {color})` | valor corto ("0 rpm", "hueco 0,01") |
| `ui.caja({w, h, rotulo, color})` / `ui.circulo({r, color})` | resaltar una pieza |
| `ui.giro({r, sentido: 'horario'/'antihorario', color})` | flecha circular de giro |
| `ui.flecha({desde, hacia, curva, color})` | flecha; extremos `[x, y]` o `{ancla, offset}` |
| `ui.tarjeta({titulo, valor, acento})` | concepto clave en una tarjeta |
| `ui.sello(texto, {color})` | veredicto que entra de golpe ("NO ENTRA") |
| `ui.nota(texto)` | aclaración o fuente pequeña, abajo a la izquierda |
| `ui.compartir({previa, nombres})` | móvil con la hoja de compartir; el dedo pulsa "Enviar" a los 1,5 s. Úsalo en la frase final |
| `fx.chispas({ancla, t, dur, n})` / `fx.temblor({t, dur, fuerza})` | impactos |
| `sonido(tipo, t, {vol, dur})` | efecto de sonido extra: `whoosh`, `pop`, `clic`, `golpe`, `chispas`. Ya suenan solos los movimientos de cámara (whoosh), las anotaciones (pop), los sellos y temblores (golpe), las chispas y el móvil de compartir; añade solo lo que falte (una pieza que encaja: `clic`) |

**Zonas de pantalla**:
- y 260-430: subtítulos. No pongas nada ahí.
- y 450-1250: zona principal.
- y 1250-1420: tarjetas y sellos.
- Por debajo de y 1450 lo tapa la interfaz de TikTok: solo `ui.nota`.

Colores: cian `#2ee6f0`, azul `#4f7dff`, morado `#a46bff`, amarillo `#ffd23f`, naranja `#ff9b3d`, rojo `#ff4d5e`, verde `#3ddc84`.

**Ritmo**: en cada frase pasa algo (movimiento de cámara, pieza que se mueve, resalte nuevo). Las anotaciones se van al acabar la frase salvo que digas otra cosa; no acumules más de 2-3 a la vez.
