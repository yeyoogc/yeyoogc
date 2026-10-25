# Sesión programada de @aprendesencillo

Objetivo: dejar en el Telegram de Yeyo los 2 TikToks de hoy, listos para publicar. Cada vídeo es una explicación animada **hecha a medida**: un modelo 3D del objeto o del concepto que cambia en cada frase, con anotaciones precisas y subtítulos arriba. No explores el repo: lee solo lo que se indica aquí.

## Pasos

1. `cd aprendesencillo && python3 pipeline/siguiente.py` → temas de hoy (`id | pregunta | pista`).
2. Lee `escenas/marcha-atras-120.js` y `guiones/marcha-atras-120.json`: son el ejemplo de referencia del estilo y de la API.
3. Para cada tema escribe `guiones/<id>.json` y `escenas/<id>.js` (los dos temas en la misma respuesta).
4. Previa (unos 20 s, no gasta voz si ya está en caché): `python3 pipeline/make.py guiones/<id>.json --previa`, y mira `out/<id>-previa.jpg` (un fotograma a mitad de cada frase). Corrige lo que se vea mal: cosas fuera de cuadro, solapes con los subtítulos, frases sin nada nuevo en pantalla. Como mucho 2 rondas por vídeo.
5. Render y envío en un solo comando (unos 6 min por vídeo, pon timeout de 20 min):
   `python3 pipeline/make.py guiones/<id1>.json && python3 pipeline/make.py guiones/<id2>.json && python3 pipeline/enviar.py out/<id1>.mp4 out/<id2>.mp4`
6. Si algo falla y no lo arreglas en un intento: `python3 pipeline/enviar.py --aviso "<qué ha fallado>"`. Si el paso 1 imprimió `AVISO`, mándalo igual.

No hagas commits ni push: el tema sale de la fecha y no hay estado que guardar.

## Guion (`guiones/<id>.json`)

`{ "id", "frases": [...], "caption", "hashtags" }`. Fórmula de las referencias:

- **Gancho** (frase 1): una pregunta que parece tonta o una creencia común. Frase 2: giro inmediato ("No, no está roto.", "Spoiler: no entra.").
- **Explicación paso a paso**: una idea por frase, como máximo 14 palabras. Cada frase es un cambio en pantalla.
- **Remate**: la conclusión en una frase redonda ("Así que sí, está suelto, pero a propósito.").
- **Cierre para compartir**: "Envíaselo a ese amigo que…" con algo concreto y gracioso. Varía la fórmula.
- 8-10 frases, 30-40 s, español de España, tono de colega.
- Marca con `*asteriscos*` las palabras clave: salen en blanco y en negrita; el resto, en gris.
- Escribe los números con cifras ("120", "4.000 rpm").
- Datos: solo lo bien establecido, partiendo de la `pista`. Si dudas de una cifra, quítala o confírmala con UNA búsqueda web. Nunca inventes estudios, récords ni porcentajes. Nada de consejos médicos o financieros, ni política.

## Escena (`escenas/<id>.js`)

`export default function crear(ctx) { ... }`. Montas el 3D y programas todo con tiempos sacados de la voz. **Todo debe ser función del tiempo**: nada de `Math.random`, `Date` ni `requestAnimationFrame`; para azar, `ctx.azar(semilla)`.

**Tiempos**: `f(i)` inicio de la frase i, `fin(i)` su final, `palabra(i, 'texto')` cuándo se dice esa palabra dentro de la frase i (para sincronizar golpes exactos).

**Animación**:

| función | uso |
|---|---|
| `tween(obj, {prop: valor}, {t, dur, ease})` | anima números (`mesh.position`, `mesh.rotation`, `material`…). ease: `inOut`, `sale`, `entra`, `rebote`, `lineal` |
| `color(material.color, 0xff4d5e, {t, dur})` | cambia de color |
| `cada(t => …)` | lógica continua (giros, parpadeos) |
| `acumulado(t => velocidad)` | ángulo integrado cuando la velocidad cambia |
| `camara.poner({pos, mira, fov})` / `camara.ir({pos, mira, fov}, {t, dur})` | cámara. Con fov 38, el ancho visible es ≈ 0,39 × distancia |
| `fondo.ponerBrillo(hex, a)` / `fondo.brillo(hex, {t, dur, a})` | color del resplandor del fondo |

**3D**:
- `THREE` completo y `escena`.
- Materiales: `mat.metal(color, rugosidad)`, `mat.oro()`, `mat.plastico(color)`, `mat.vidrio(color, opacidad)`, `mat.emisivo(color)`, `mat.madera()`, `mat.hormigon()`.
- Geometrías: `geo.caja(w, h, d, radio)` (caja redondeada), `geo.engranaje(dientes, radio, grosor, {aligerado, sinDiente})`, `geo.diente(...)`, `geo.textura((ctx2d, w, h) => …)` (para rótulos y etiquetas pintadas), y cualquier primitiva de THREE (Cylinder, Sphere, Lathe, Extrude, Torus…).
- Modela el objeto real simplificado, pero reconocible.

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

**Zonas de pantalla**:
- y 260-430: subtítulos. No pongas nada ahí.
- y 450-1250: zona principal.
- y 1250-1420: tarjetas y sellos.
- Por debajo de y 1450 lo tapa la interfaz de TikTok: solo `ui.nota`.

Colores: cian `#2ee6f0`, azul `#4f7dff`, morado `#a46bff`, amarillo `#ffd23f`, naranja `#ff9b3d`, rojo `#ff4d5e`, verde `#3ddc84`.

**Ritmo**: en cada frase pasa algo (movimiento de cámara, pieza que se mueve, resalte nuevo). Las anotaciones se van al acabar la frase salvo que digas otra cosa; no acumules más de 2-3 a la vez.
