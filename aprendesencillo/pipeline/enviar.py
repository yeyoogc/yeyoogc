#!/usr/bin/env python3
"""Manda los vídeos (con su texto para TikTok) o un aviso a tu Telegram.

Uso: python3 pipeline/enviar.py out/a.mp4 [out/b.mp4 ...]
     python3 pipeline/enviar.py --aviso "texto"
Necesita TELEGRAM_BOT_TOKEN. TELEGRAM_CHAT_ID es opcional: si no está, se usa el último chat
privado que haya escrito al bot (Telegram solo guarda esos mensajes 24 h).
"""
import json
import os
import subprocess
import sys
from pathlib import Path

token = os.environ.get("TELEGRAM_BOT_TOKEN")
if not token:
    sys.exit("Falta TELEGRAM_BOT_TOKEN en el entorno.")
API = f"https://api.telegram.org/bot{token}"


def descubrir_chat():
    datos = json.loads(subprocess.check_output(["curl", "-sS", "--fail", f"{API}/getUpdates"]))
    chats = [u["message"]["chat"]["id"] for u in datos.get("result", []) if u.get("message", {}).get("chat", {}).get("type") == "private"]
    if not chats:
        sys.exit("Falta TELEGRAM_CHAT_ID y nadie ha escrito al bot en las últimas 24 h: abre el bot en Telegram, pulsa Iniciar y vuelve a lanzarlo.")
    return str(chats[-1])


chat_fijo = os.environ.get("TELEGRAM_CHAT_ID")
chat = chat_fijo or descubrir_chat()


def curl(metodo, *campos):
    subprocess.run(["curl", "-sS", "--fail", "-o", os.devnull, "--form-string", f"chat_id={chat}", *campos, f"{API}/{metodo}"],
                   check=True)


if len(sys.argv) == 3 and sys.argv[1] == "--aviso":
    curl("sendMessage", "--form-string", f"text=⚠️ @aprendesencillo: {sys.argv[2]}")
elif len(sys.argv) < 2:
    sys.exit(__doc__)
else:
    for mp4 in map(Path, sys.argv[1:]):
        texto = mp4.with_suffix(".txt").read_text(encoding="utf-8")[:1024]
        # Sin medidas ni miniatura, Telegram a veces enseña el vídeo achatado (como si fuera 4:3 o cuadrado).
        info = json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "json", str(mp4)]))
        ancho, alto, dur = info["streams"][0]["width"], info["streams"][0]["height"], round(float(info["format"]["duration"]))
        mini = mp4.with_suffix(".mini.jpg")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", "1", "-i", str(mp4), "-frames:v", "1", "-vf", "scale=180:320", "-q:v", "5", str(mini)], check=True)
        curl("sendVideo", "--form-string", f"caption={texto}", "--form-string", "supports_streaming=true",
             "--form-string", f"width={ancho}", "--form-string", f"height={alto}", "--form-string", f"duration={dur}",
             "--form-string", "thumbnail=attach://mini", "-F", f"mini=@{mini}", "-F", f"video=@{mp4}")   # la API exige attach:// para la miniatura
        print(f"Enviado {mp4.name} ({ancho}x{alto}, {dur} s)")
if not chat_fijo:
    curl("sendMessage", "--form-string", f"text=Para que te lleguen siempre (y no solo si me has escrito en las últimas 24 h), añade esta variable al entorno:\n\nTELEGRAM_CHAT_ID={chat}")
