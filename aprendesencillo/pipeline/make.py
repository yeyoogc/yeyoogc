#!/usr/bin/env python3
"""Convierte un guion JSON en un vídeo vertical para TikTok.

Uso: python3 pipeline/make.py guiones/<id>.json  ->  out/<id>.mp4 + out/<id>.txt
"""
import asyncio
import json
import os
import ssl
import subprocess
import sys
import tempfile
from pathlib import Path

try:
    import edge_tts
except ImportError:  # las sesiones programadas arrancan en un contenedor limpio
    subprocess.run([sys.executable, "-m", "pip", "install", "-q", "edge-tts"], check=True)
    import edge_tts
import edge_tts.communicate as communicate

RAIZ = Path(__file__).resolve().parent.parent
VOZ = "es-ES-AlvaroNeural"
RITMO = "+10%"
PAUSA = 0.3   # silencio entre escenas (s)
COLA = 0.8    # margen final para que no corte en seco (s)

# En las sesiones en la nube el tráfico sale por un proxy con su propia CA.
CA_PROXY = "/root/.ccr/ca-bundle.crt"
if os.path.exists(CA_PROXY):
    communicate._SSL_CTX = ssl.create_default_context(cafile=CA_PROXY)


def ff(*args):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *args], check=True)


def duracion(ruta):
    salida = subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(ruta)])
    return float(salida)


async def sintetizar(texto, voz, ritmo, destino):
    com = edge_tts.Communicate(texto, voz, rate=ritmo, boundary="WordBoundary")
    palabras = []
    with open(destino, "wb") as f:
        async for trozo in com.stream():
            if trozo["type"] == "audio":
                f.write(trozo["data"])
            elif trozo["type"] == "WordBoundary":
                palabras.append({"t": trozo["offset"] / 1e7, "d": trozo["duration"] / 1e7, "w": trozo["text"]})
    return palabras


def mezclar_audio(voz_wav, escenas, tmp):
    """Voz + un 'whoosh' suave en cada cambio de escena, normalizado a -14 LUFS."""
    whoosh = tmp / "whoosh.wav"
    ff("-f", "lavfi", "-i", "anoisesrc=d=0.5:c=pink:a=0.6",
       "-af", "highpass=f=500,lowpass=f=5000,afade=t=in:d=0.2,afade=t=out:st=0.2:d=0.3,volume=0.18",
       "-ar", "48000", "-ac", "1", str(whoosh))
    entradas, filtros = ["-i", str(voz_wav)], []
    for k, e in enumerate(escenas[1:], start=1):
        entradas += ["-i", str(whoosh)]
        filtros.append(f"[{k}]adelay={max(0, int((e['inicio'] - 0.15) * 1000))}[w{k}]")
    golpes = "".join(f"[w{k}]" for k in range(1, len(escenas)))
    filtros.append(f"[0]{golpes}amix=inputs={len(escenas)}:normalize=0:duration=first,loudnorm=I=-14:TP=-1.5:LRA=11[a]")
    audio = tmp / "audio.wav"
    ff(*entradas, "-filter_complex", ";".join(filtros), "-map", "[a]", "-ar", "48000", str(audio))
    return audio


async def main(ruta_guion):
    guion = json.loads(Path(ruta_guion).read_text(encoding="utf-8"))
    vid = guion["id"]
    voz, ritmo = guion.get("voz", VOZ), guion.get("ritmo", RITMO)
    salida = RAIZ / "out"
    salida.mkdir(exist_ok=True)
    tmp = Path(tempfile.mkdtemp(prefix=f"{vid}-"))

    escenas, palabras, wavs, t = [], [], [], 0.0
    for i, esc in enumerate(guion["escenas"]):
        mp3, wav = tmp / f"{i:02d}.mp3", tmp / f"{i:02d}.wav"
        pal = await sintetizar(esc["texto"], voz, ritmo, mp3)
        ff("-i", str(mp3), "-af", f"apad=pad_dur={PAUSA}", "-ar", "48000", "-ac", "1", str(wav))
        d = duracion(wav)
        escenas.append({"inicio": round(t, 3), "fin": round(t + d, 3), "texto": esc["texto"], "visual": esc["visual"]})
        palabras += [{**p, "t": round(t + p["t"], 3)} for p in pal]
        wavs.append(wav)
        t += d
    total = t + COLA
    escenas[-1]["fin"] = round(total, 3)

    lista = tmp / "lista.txt"
    lista.write_text("".join(f"file '{w}'\n" for w in wavs))
    voz_wav = tmp / "voz.wav"
    ff("-f", "concat", "-safe", "0", "-i", str(lista), "-af", f"apad=pad_dur={COLA}", str(voz_wav))
    audio = mezclar_audio(voz_wav, escenas, tmp)

    timeline = {"titulo": guion["titulo"], "duracion": round(total, 3), "escenas": escenas, "palabras": palabras}
    ruta_tl = tmp / "timeline.json"
    ruta_tl.write_text(json.dumps(timeline, ensure_ascii=False), encoding="utf-8")
    mp4 = salida / f"{vid}.mp4"
    subprocess.run(["node", str(RAIZ / "pipeline" / "render.cjs"), str(ruta_tl), str(audio), str(mp4)], check=True)

    texto = guion["caption"].strip() + "\n\n" + " ".join(guion.get("hashtags", []))
    (salida / f"{vid}.txt").write_text(texto + "\n", encoding="utf-8")
    print(f"OK {mp4} ({total:.1f} s)")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    asyncio.run(main(sys.argv[1]))
