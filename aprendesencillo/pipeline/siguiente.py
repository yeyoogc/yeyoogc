#!/usr/bin/env python3
"""Imprime los temas que tocan hoy.

El tema sale de la fecha (días desde "inicio" x "por_dia"), así que no hay estado que guardar
ni commits que hacer. Para cambiar lo que sale, edita temas.json a partir de la posición de hoy.

Uso: python3 pipeline/siguiente.py [AAAA-MM-DD]
"""
import json
import sys
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

RAIZ = Path(__file__).resolve().parent.parent
AVISO_QUEDAN = 14

cfg = json.loads((RAIZ / "temas.json").read_text(encoding="utf-8"))
hoy = date.fromisoformat(sys.argv[1]) if len(sys.argv) > 1 else datetime.now(ZoneInfo("Europe/Madrid")).date()
temas, por_dia = cfg["temas"], cfg["por_dia"]
primero = (hoy - date.fromisoformat(cfg["inicio"])).days * por_dia

if primero < 0:
    sys.exit(f"Todavía no toca: el calendario empieza el {cfg['inicio']}.")
for i in range(primero, primero + por_dia):
    if i < len(temas):
        t = temas[i]
        print(f"{t['id']} | {t['pregunta']} | {t['pista']}")
    else:
        print("SIN TEMAS: inventa uno nuevo que no esté en temas.json")
quedan = len(temas) - (primero + por_dia)
if quedan < AVISO_QUEDAN:
    print(f"AVISO: quedan {max(0, quedan)} temas en el banco")
