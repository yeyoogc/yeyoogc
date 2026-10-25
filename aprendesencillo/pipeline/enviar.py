#!/usr/bin/env python3
"""Manda los vídeos (con su texto para TikTok) o un aviso a tu Telegram.

Uso: python3 pipeline/enviar.py out/a.mp4 [out/b.mp4 ...]
     python3 pipeline/enviar.py --aviso "texto"
Necesita las variables de entorno TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID.
"""
import os
import subprocess
import sys
from pathlib import Path

token, chat = os.environ.get("TELEGRAM_BOT_TOKEN"), os.environ.get("TELEGRAM_CHAT_ID")
if not token or not chat:
    sys.exit("Faltan TELEGRAM_BOT_TOKEN y/o TELEGRAM_CHAT_ID en el entorno.")
API = f"https://api.telegram.org/bot{token}"


def curl(metodo, *campos):
    subprocess.run(["curl", "-sS", "--fail", "-o", os.devnull, "--form-string", f"chat_id={chat}", *campos, f"{API}/{metodo}"],
                   check=True)


if len(sys.argv) == 3 and sys.argv[1] == "--aviso":
    curl("sendMessage", "--form-string", f"text=⚠️ @aprendesencillo: {sys.argv[2]}")
    sys.exit()
if len(sys.argv) < 2:
    sys.exit(__doc__)
for mp4 in map(Path, sys.argv[1:]):
    texto = mp4.with_suffix(".txt").read_text(encoding="utf-8")[:1024]
    curl("sendVideo", "--form-string", f"caption={texto}", "--form-string", "supports_streaming=true", "-F", f"video=@{mp4}")
    print(f"Enviado {mp4.name}")
