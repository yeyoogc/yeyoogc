#!/usr/bin/env python3
"""Imprime los temas que tocan hoy.

El tema sale de la fecha (días desde "inicio" x "por_dia"), así que no hay estado que guardar
ni commits que hacer. Para cambiar lo que sale, edita temas.json a partir de la posición de hoy.

Uso: python3 pipeline/siguiente.py [--turno N] [AAAA-MM-DD]   (turno 0 = mañana, 1 = tarde; sin turno, todos los de hoy)
"""
import json
import sys
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

RAIZ = Path(__file__).resolve().parent.parent
AVISO_QUEDAN = 14
# El gancho y el cierre rotan con el tema para que los vídeos no empiecen ni acaben siempre igual.
GANCHOS = [
    "pregunta directa y, en la frase 2, una respuesta que descoloca (sin muletillas). Ej.: «¿Por qué las alcantarillas son redondas? No es por estética.»",
    "abre con la cifra o el hecho más bestia del tema y después plantea la pregunta. Ej.: «Dentro de una olla exprés el agua hierve a 120 grados.»",
    "abre con lo que todo el mundo cree y desmiéntelo. Ej.: «Todo el mundo cree que en el espacio explotas. Pues te pasa algo más raro.»",
    "experimento mental en segunda persona. Ej.: «Imagina que vas a 120 por la autovía y metes la marcha atrás.»",
    "señala un detalle que todos han visto y nadie se ha fijado. Ej.: «Mira el fondo de cualquier lata. No es plano.»",
    "empieza por el final: suelta la respuesta en una frase y luego cuenta el porqué. Ej.: «Si el plato del microondas no girara, la mitad de tu comida saldría helada.»",
    "reto al espectador. Ej.: «Seguro que no sabes por qué los relojes de los anuncios marcan las 10:10.»",
    "comparación que no te esperas. Ej.: «Un rayo está más caliente que la superficie del Sol, y dentro del coche no te pasa nada.»",
]
CIERRES = [
    "Envíaselo a ese amigo que… (algo concreto y gracioso)",
    "Pásaselo a quien… (alguien muy concreto)",
    "Mándaselo al grupo de… (un grupo reconocible: la familia, el curro, el fútbol…)",
    "Compártelo con alguien que… (un reto: que lo adivine antes del final)",
]

cfg = json.loads((RAIZ / "temas.json").read_text(encoding="utf-8"))
args = sys.argv[1:]
turno = int(args.pop(args.index("--turno") + 1)) if "--turno" in args else None
if "--turno" in args:
    args.remove("--turno")
hoy = date.fromisoformat(args[0]) if args else datetime.now(ZoneInfo("Europe/Madrid")).date()
temas, por_dia = cfg["temas"], cfg["por_dia"]
primero = (hoy - date.fromisoformat(cfg["inicio"])).days * por_dia

if primero < 0:
    sys.exit(f"Todavía no toca: el calendario empieza el {cfg['inicio']}.")
for i in [primero + turno] if turno is not None else range(primero, primero + por_dia):
    if i < len(temas):
        t = temas[i]
        print(f"{t['id']} | {t['pregunta']} | {t['pista']}")
        print(f"  gancho: {GANCHOS[i % len(GANCHOS)]}")
        print(f"  cierre: {CIERRES[(i * 3) % len(CIERRES)]}")
    else:
        print("SIN TEMAS: inventa uno nuevo que no esté en temas.json")
quedan = len(temas) - (primero + por_dia)
if quedan < AVISO_QUEDAN:
    print(f"AVISO: quedan {max(0, quedan)} temas en el banco")
