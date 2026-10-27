# Sesión programada de @aprendesencillo

Hay dos sesiones al día: **turno 0** (mañana) y **turno 1** (tarde). El mensaje que te lanza dice cuál eres. Cada una deja en el Telegram de Yeyo **un** TikTok de 1 minuto a 60 fps, listo para publicar en la hora punta siguiente.

Cada vídeo es una explicación animada **hecha a medida**, en **estilo 3D ilustrado** (el de los vídeos que Yeyo toma como referencia): mundos enteros estilizados (cielo con degradado, suelo, niebla), personas estilizadas sin cara, multitudes de cientos de figuras para dar escala a las cifras, colores planos y vivos, luces que brillan, cifras en píldora y metáforas visuales para cada dato. La cámara recorre ese mundo y en cada frase cambia algo, con subtítulos arriba. No explores el repo: lee solo lo que se indica aquí.

## Pasos

0. Comprueba que existen `ELEVENLABS_API_KEY` y `TELEGRAM_BOT_TOKEN`. Si falta alguna, para aquí y termina diciendo cuál falta: sin ellas no hay voz buena ni forma de entregar el vídeo. `TELEGRAM_CHAT_ID` es opcional: si no está, `enviar.py` lo descubre solo y le dice a Yeyo cuál es. Si `CLAUDE_CODE_EFFORT_LEVEL` no vale `xhigh` ni `max`, sigue, pero dilo en el resumen final.
1. `cd aprendesencillo && python3 pipeline/siguiente.py --turno <N>` → tu tema (`id | pregunta | pista`), el tipo de gancho y la fórmula de cierre que tocan hoy.
2. Mira `referencia/agujero-negro-previa.jpg` (el listón de calidad) y lee `escenas/agujero-negro.js` y `guiones/agujero-negro.json`: son el ejemplo del estilo ilustrado, de la API y de cómo se escriben `look` y `planos` (con números). Si tu tema es un objeto técnico suelto (una cerradura, una caja de cambios), mira también el ejemplo de producto: `referencia/marcha-atras-120-previa.jpg` y `escenas/marcha-atras-120.js`.
3. **Plano de rodaje antes de programar, con números y no con adjetivos** («premium», «chulo» o «dinámico» no son instrucciones: un número sí). En el propio `guiones/<id>.json` añade:
   - `"look"`: una línea con los materiales del objeto principal (cuál de `mat.*`, color en hex y rugosidad) y **un solo** color de acento para las anotaciones.
   - `"planos"`: una línea por frase con este formato: `CÁMARA de [pos] a [pos], fov N, inOut N s · HÉROE: el único movimiento protagonista, muelle X, N s · SECUNDARIO: lo que acompaña (50-70 % del recorrido, 0,1-0,2 s después) · ANOTACIÓN: cuál y dónde · PASO: cómo enlaza con el plano siguiente (movimiento de cámara continuo o una pieza que se convierte en la siguiente)`.
   Comprueba que cada frase tiene un cambio visual claro y un «momento» fuerte cada 3-5 s. Después escribe `escenas/<id>.js` siguiendo ese plan y los números de «Movimiento» de abajo.
4. **Bucle de crítica** (aquí se gana o se pierde el vídeo):
   1. Saca la previa: `python3 pipeline/make.py guiones/<id>.json --previa` (unos 30 s; la voz queda en caché y no se vuelve a gastar).
   2. Mira `out/<id>-previa.jpg` (un fotograma a mitad de cada frase) al lado de `referencia/marcha-atras-120-previa.jpg`. Los fotogramas sueltos, a tamaño real, están en `out/<id>-previa/NN.jpg`: ábrelos cuando dudes de un detalle. La previa también imprime una **medición** por frase; si alguna sale `CASI VACÍO` o `MUY CLARO`, ese plano está mal aunque a simple vista parezca correcto. Las **transiciones** marcan con `SALTO` los cambios de frase donde la imagen pega un salto. La **maquetación** lista las anotaciones que pisan algo y no se han podido apartar solas: arréglalas. Y el **coste de render**: segundos por fotograma de cada frase y minutos estimados (a 60 fps). Si alguna frase sale `PESADA` o el total pasa de 48 min, aligérala en esta misma ronda (ver «Rendimiento» abajo): si no, el render baja solo la resolución del 3D y el vídeo se ve peor.
   3. Puntúa cada fotograma del 1 al 10 en cuatro cosas:
      - **acabado**: texturas, detalle y formas definidas (biseles que brillan, siluetas que se recortan contra el fondo), nada que parezca de juguete;
      - **composición**: el objeto llena el cuadro y no hay solapes ni nada cortado sin querer;
      - **claridad**: se entiende la idea de esa frase sin audio;
      - **legibilidad**: subtítulos y anotaciones se leen bien.
   4. Escribe los 3 peores problemas **con el número de frase** y lo que hay que cambiar en números («frase 6: el diente sale a 0,4 del borde, acércalo a 0,2»), arréglalos y repite. Revisa también la lista de **tópicos prohibidos**: si se ha colado alguno, quítalo. Si la previa marca algún `SALTO`, ese cambio de plano es un corte o algo aparece de golpe: conviértelo en movimiento.
   5. Para cuando todo esté en 8 o más, o tras 3 rondas. Si después tocas algo, saca otra previa antes del render: nada entra en el vídeo sin haberlo visto.
5. Render y envío (lo que dijo la previa, normalmente 25-40 min): lánzalo **en segundo plano** con el aviso de fallo encadenado y espera a que acabe:
   `python3 pipeline/make.py guiones/<id>.json && python3 pipeline/enviar.py out/<id>.mp4 || python3 pipeline/enviar.py --aviso "Falló el render o el envío de <id>"`
6. Si algo falla y no lo arreglas en un intento: `python3 pipeline/enviar.py --aviso "<qué ha fallado>"`. Si el paso 1 imprimió `AVISO`, mándalo igual.

No hagas commits, push ni PRs: el tema sale de la fecha y no hay estado que guardar.

## Guion (`guiones/<id>.json`)

`{ "id", "frases": [...], "caption", "hashtags" }`. Temas curiosos explicados como en las referencias:

- **Gancho** (frases 1-2): usa el tipo de gancho que imprime `siguiente.py` (cambia cada vídeo). La frase 2 da el giro en palabras propias de este tema.
- **Prohibido** abrir o girar con muletillas de plantilla: «Spoiler», «Respuesta corta», «Alerta», «Dato curioso», «¿Sabías que…?», «Te lo explico», «Atento», «Agárrate». Tampoco copies frases del guion de ejemplo: es para ver el formato, no el texto.
- **Explicación paso a paso**: una idea por frase, como máximo 14 palabras. Cada frase es un cambio en pantalla.
- **Un segundo giro a mitad** (un dato que nadie espera, o "y aquí viene lo bueno") para que no se vayan antes del final.
- **Remate**: la conclusión en una frase redonda ("Así que sí, está suelto, pero a propósito.").
- **Cierre para compartir**: la fórmula que imprime `siguiente.py`, con algo concreto y gracioso de este tema (va con `ui.compartir`).
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
| `camara.poner({pos, mira, fov})` / `camara.ir({pos, mira, fov}, {t, dur})` | cámara. Con fov 38, el ancho visible es ≈ 0,39 × distancia. Sale a 60 fps: se ve cada salto, así que todo cambio de plano es un `camara.ir`, nunca un `poner` a mitad de vídeo |
| `camara.deriva(v, {t, dur})` | vaivén lento de la cámara para que el plano nunca esté muerto (1 por defecto, 0 = trípode, 2 = cámara en mano suave). Ponlo a 0 en los macros donde la precisión importa |
| `fondo.ponerBrillo(hex, a)` / `fondo.brillo(hex, {t, dur, a})` | color del resplandor del fondo |

**Estilo ilustrado** (lo que marca la diferencia):
- **Un mundo, no un objeto flotando en negro**: `mundo(nombre)` pone cielo con degradado, niebla, suelo y la luz de ese ambiente. Nombres: `atardecer`, `dia`, `noche` (ciudad, morados), `espacio` (estrellas), `estadio` (morado con focos), `azul` (tecnología, azul marino, sin suelo). `mundo(nombre, {t})` cambia de mundo en ese instante (corte entre secciones). Sin `mundo`, queda el estudio oscuro de producto: solo para objetos técnicos sueltos.
- **Personas**: `persona({ropa, pantalon, piel, pelo, sombrero, traje: 'astronauta', poses: [[t, 'quieto'], [t2, 'andar']], reloj})` devuelve un grupo (mide 1,8; los pies en y = 0) con poses `quieto`, `andar`, `animar` (brazos arriba), `trabajar`, `flotar`, `senalar`; las piezas están en `p.userData.partes` (`cab`, `torso`, `hI`/`hD` hombros, `cI`/`cD` caderas) para anclar etiquetas o moverlas. Escálala o estírala con `p.scale`. **Nunca construyas una persona a mano** con cápsulas sueltas: usa esta (o `multitud`).
- **Multitudes y escala**: `multitud({n, centro, area: [ancho, fondo], pose, colores, sombrero, escala, mirar: [x, z]})` dibuja cientos o miles de personas por muy poco. Úsala para que las cifras se sientan («35 millones de agricultores» = un campo lleno hasta el horizonte). `repetir({geometria, material, filas, columnas, paso: [dx, dz], centro, escala, alto, girar})` repite cualquier pieza (plantas, butacas, edificios, trofeos); `.aparecer(t, dur)` la hace crecer de cerca a lejos.
- **Metáforas visuales para cada dato**: un bote que se llena, una balanza que se inclina, tubos llenos de bolas que comparan dos cifras, una fila de trofeos que forma un camino, una gráfica que cae. Cada cifra importante, en `ui.cifra`.
- **Luz que brilla**: en este estilo sí van focos, neón, LEDs y resplandor: `foco({desde, hacia, color, ancho})` (haz de luz visible), `mat.emisivo(color)` y `dof.resplandor`.
- **Colores planos**: `mat.plano(color)` (sombreado suave; `{duro: true}` en bandas; `{emisivo: 0.8}` brilla) para el mundo, la gente y las piezas de decorado. Los `mat.*` realistas (metal, oro, vidrio) solo en el objeto protagonista.
- **Encuadre vertical**: lo alto y estrecho llena la pantalla. Las caídas, los estirones y las personas, de pie y en vertical; nunca un objeto largo tumbado en horizontal.
- `mirarCamara(obj)`: que algo mire siempre a cámara (anillos, halos, carteles).

**3D**:
- `THREE` completo y `escena`.
- Materiales: `mat.metal(color, rugosidad)` (cepillado), `mat.metalPulido()`, `mat.oro()`, `mat.laton()`, `mat.plastico(color, rugosidad)`, `mat.goma()`, `mat.vidrio(color, opacidad)`, `mat.emisivo(color)`, `mat.madera(rx, ry)`, `mat.hormigon(rx, ry)` y `mat.pintado((ctx2d, w, h) => …)` para rótulos, escalas, pantallas, patrones o placas.
- Geometrías: `geo.caja(w, h, d, radio)` (redondeada), `geo.extruir(shape, grosor, bisel)`, `geo.torno([[radio, altura], …])` (pomos, botellas, latas, bombillas), `geo.engranaje(dientes, radio, grosor, {aligerado, sinDiente})`, `geo.diente(...)`, `geo.ejeEstriado(radio, largo)`, y cualquier primitiva de THREE.
- Rendimiento (el render es por CPU, sin tarjeta gráfica): lo que más cuesta es lo que llena la pantalla y las pasadas de sombra. Una `PointLight` o `SpotLight` con `castShadow` vuelve a pintar la escena (6 veces la PointLight): para dar ambiente usa luces sin sombra, `mat.emisivo` o `halo`. Piezas repetidas (traviesas, tornillos, dientes sueltos): `THREE.InstancedMesh`, no cientos de mallas. Cilindros y toros con 32-64 segmentos bastan a este tamaño. Lo que ya no sale en cuadro, `visible = false`.
- Ayudantes: `bordes(malla, {color})` (aristas iluminadas, para cristales y piezas fantasma), `halo(obj, {color, tam})` (resplandor; anima `halo.material.opacity`), `suelo({y})` (recibe sombras), `sombras({centro, tam})` (zona que cubre la luz que da sombra; si la escena salta de sitio, llámalo dentro de `cada`).
- Profundidad de campo: enfoca solo el punto al que mira la cámara. `dof.apertura` (1 suave, 2,5 macro) y `dof.foco` (0 = automático). `dof.resplandor` (0,5 por defecto) hace brillar emisivos y reflejos fuertes: súbelo para un fogonazo o un LED, bájalo si el plano se ve lechoso. Anímalo todo con `tween(dof, …)`.
- Luz: el motor ya trae la luz principal con sombra, contraluz y unas cajas de luz que se reflejan en el metal y dibujan los cantos; `mundo()` la ajusta a cada ambiente. No añadas luces para «iluminar más»: si algo sale oscuro, gíralo hacia la luz o cambia el ángulo de cámara.
- Calidad mínima:
  - Si el tema va de una persona, **sale la persona** (`persona`), no una pieza suelta que la represente: un astronauta es un astronauta entero, no una bota con un casco. Animales: estilizados y simples (formas redondeadas, colores planos, sin cara realista), en la línea de las personas; si no queda claro, cuéntalo con objetos y cifras.
  - Modela el objeto real con sus detalles (biseles, tornillos, estrías, rótulos, texturas), no un bloque genérico.
  - **Formas definidas**: nada de `BoxGeometry` ni cilindros a pelo en piezas que se ven de cerca: usa `geo.caja` (canto redondeado), `geo.extruir` con bisel o `geo.torno`, porque los biseles son lo que pilla las cajas de luz y hace que la pieza se lea. Nada de superficies grandes lisas de un solo color: dales textura (`mat.metal`, `mat.plastico`, `mat.pintado`). Una pieza rota o suelta se modela con su forma real (un diente con su perfil, una esquirla con `geo.extruir`), no con un cubo rojo.
  - El render siempre sale en vertical 1080×1920: no toques `pipeline/`.
  - Planos macro: el objeto llena el ancho y puede salirse un poco del cuadro.
  - Que no lave la imagen: un cielo claro (`dia`) está bien, pero el objeto protagonista tiene que contrastar con él, y la franja de los subtítulos ya se oscurece sola.
  - Dentro de una sección, transiciones con cámara en movimiento continuo (bajar al interior, barrido lateral). Entre secciones (de 2 a 3 por vídeo, p. ej. al cambiar de mundo) vale un corte con `sonido('whoosh', t)`: la previa los marcará como `SALTO` y está bien si son esos.

**Anotaciones** (HTML encima del 3D). Todas aceptan `t`, `hasta` (por defecto, el final de la frase), y una posición: `ancla` (un objeto 3D o `[x,y,z]`) con `offset`, o `x`/`y` en píxeles (lienzo de 1080×1920).

| función | qué es |
|---|---|
| `ui.cifra({texto, unidad, tam})` | **la cifra del estilo ilustrado**: número grande en una píldora oscura («200» + «millones»). `texto` puede ser `t => …` para un contador |
| `ui.grafica({puntos, color, x, y, w, h, dur})` | gráfica de línea que se dibuja sola con un punto brillante en la punta (`puntos`: valores, se escalan solos) |
| `ui.numero({texto, unidad, tam})` | cifra gigante en monoespaciada con dígitos de colores (estilo producto) |
| `ui.etiqueta(texto, {color})` | valor corto ("0 rpm", "hueco 0,01"). Si queda lejos de su `ancla`, sale sola una línea guía con un punto sobre la pieza (`linea: false` la quita) |
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
- y 250-450: subtítulos (con una franja oscura detrás para que se lean). El motor oscurece esa franja del 3D, así que no encuadres ahí lo importante.
- y 450-1250: zona principal.
- y 1250-1420: tarjetas y sellos.
- Por debajo de y 1450, y a la derecha por debajo de y 1060, lo tapa la interfaz de TikTok: solo `ui.nota`.
- Las anotaciones de texto (`etiqueta`, `tarjeta`, `numero`, `texto`) se apartan solas lo justo para no pisar los subtítulos, otra anotación, los bordes ni los botones de TikTok. Cajas, círculos y sellos se quedan donde los pones (`quieto: true` fija también una de texto). Aun así, colócalas bien de entrada: si se apartan mucho, se alejan de lo que señalan.

Colores: cian `#2ee6f0`, azul `#4f7dff`, morado `#a46bff`, amarillo `#ffd23f`, naranja `#ff9b3d`, rojo `#ff4d5e`, verde `#3ddc84`.

**Movimiento** (los números que separan un vídeo de estudio de uno genérico):
- Curvas: lo que entra, `sale` (ease-out); lo que se va, `entra` y un 40-50 % más corto; lo que cruza la pantalla, `inOut`; `lineal` solo para giros continuos.
- Muelles: `pesado` (amortiguamiento 1, sin rebote) para piezas grandes; `muelle` (0,85, el aspecto «caro») por defecto; `rapido` (0,75) para piezas pequeñas; `jugueton` (0,5) solo para algo gracioso. La opacidad y el color nunca rebotan: anímalos con curvas.
- Duraciones: piezas pequeñas 0,2-0,5 s; el movimiento héroe 0,6-0,9 s; la cámara 0,8-1,6 s. Antes de un golpe, 3-4 fotogramas (0,05-0,07 s) de anticipación en sentido contrario.
- **Un héroe por plano.** Lo secundario recorre el 50-70 % y empieza 0,1-0,2 s después; lo ambiental (menos del 5 %) va en un seno lento y nunca para.
- Exagera las poses clave un 10-30 %: en el móvil todo se ve pequeño.
- Las anotaciones que entran a la vez se escalonan solas 90 ms y el sonido ya va un fotograma por detrás de la imagen. Tú sincroniza cada golpe visual con `palabra()`.

**Tópicos prohibidos**: un objeto suelto flotando en negro cuando el tema tiene un lugar (usa `mundo`); personas hechas a mano con cápsulas, o una pieza suelta en lugar de la persona; partículas flotando de adorno; resplandor en lo que no emite luz; el objeto girando sobre sí mismo sin motivo; todo apareciendo a la vez; texto que se mueve mientras se lee (una etiqueta pegada a una pieza que se mueve rápido: usa `quieto: true` con `x`/`y`). Tras cada previa, apunta qué tópico se ha colado y quítalo.

**Ritmo**: en cada frase pasa algo (movimiento de cámara, pieza que se mueve, resalte nuevo). Las anotaciones se van al acabar la frase salvo que digas otra cosa; no acumules más de 2-3 a la vez.
