# Sesión programada de @aprendesencillo

Objetivo: dejar en el Telegram de Yeyo los 2 TikToks de hoy, listos para publicar. Hazlo en el menor número de pasos posible: no explores el repo ni leas archivos que no se mencionan aquí.

## Pasos

1. `cd aprendesencillo && python3 pipeline/siguiente.py` → los temas de hoy (`id | pregunta | pista`).
2. Escribe `guiones/<id>.json` para cada tema (formato abajo), los dos en la misma respuesta.
3. Un solo comando (tarda ~5 min, pon timeout de 10 min):
   `python3 pipeline/make.py guiones/<id1>.json && python3 pipeline/make.py guiones/<id2>.json && python3 pipeline/enviar.py out/<id1>.mp4 out/<id2>.mp4`
4. Si algo falla, corrige y reintenta una vez. Si sigue fallando: `python3 pipeline/enviar.py --aviso "<qué ha fallado>"` y termina.
5. Si el paso 1 imprimió una línea `AVISO`, mándala con `enviar.py --aviso`.

No hagas commits ni push: el tema sale de la fecha, no hay estado que guardar.

## Reglas del guion

- 35-45 s: 6-8 escenas y 90-120 palabras en total. Español de España, tono de colega, frases cortas.
- Escena 1 = gancho en menos de 3 s: el dato más sorprendente o la consecuencia más bestia. Nada de saludos ni relleno.
- Última escena: pregunta para que la gente comente. Varía la fórmula de un vídeo a otro.
- Datos: solo cosas bien establecidas, con cifras redondeadas. Parte de la `pista`. Si dudas de una cifra, quítala o confírmala con UNA búsqueda web. Nunca inventes estudios, récords ni porcentajes.
- Nada de consejos médicos o financieros, ni política.
- Escribe los números con cifras ("1.670 kilómetros por hora", "200 gramos"): la voz los lee bien y salen así en los subtítulos.
- No repitas el mismo tipo de visual en dos escenas seguidas.

## Formato

Ejemplo completo: `guiones/tierra-deja-de-girar.json`.

```json
{
  "id": "<id del tema>",
  "titulo": "¿...? (máx. ~40 caracteres)",
  "escenas": [{ "texto": "lo que dice la voz", "visual": { "tipo": "...", "...": "..." } }],
  "caption": "1-2 frases + emoji + invitación a comentar",
  "hashtags": ["#aprendesencillo", "#curiosidades", "..."]
}
```

## Visuales (`visual.tipo`)

Los iconos son emojis.

| tipo | campos | qué hace |
|---|---|---|
| `contador` | `valor`, `unidad`, `etiqueta`, `icono?`, `decimales?` | número gigante que sube |
| `comparar` | `items` (2-4: `nombre`, `valor`, `icono`), `unidad` | barras; la mayor sale en amarillo |
| `icono` | `icono`, `texto?`, `subtexto?` | emoji grande; `texto` de 14 caracteres o menos queda mejor |
| `flecha` | `de` y `a` (cada uno `icono`, `texto`) | transformación A → B |
| `lista` | `items` (2-4: `icono`, `texto`) | puntos que aparecen uno a uno |
| `tierra` | `modo` (`gira`/`frena`/`parada`), `texto?`, `voladores?` (emojis) | planeta animado; en `frena` salen cosas volando |
| `dianoche` | `dia?`, `noche?` | disco día/noche ("6 meses") |
