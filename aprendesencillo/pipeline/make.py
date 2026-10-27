#!/usr/bin/env python3
"""Convierte guiones/<id>.json + escenas/<id>.js en un vídeo vertical para TikTok.

Uso: python3 pipeline/make.py guiones/<id>.json           ->  out/<id>.mp4 + out/<id>.txt
     python3 pipeline/make.py guiones/<id>.json --previa  ->  out/<id>-previa.jpg (un fotograma por frase, para revisar)

Voz: ElevenLabs si existe ELEVENLABS_API_KEY; si no, edge-tts (gratis). La voz se guarda en caché
(out/cache), así que repetir la previa o el render no vuelve a gastar caracteres.
"""
import asyncio
import base64
import difflib
import hashlib
import json
import os
import ssl
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
VOZ_ELEVEN = "6xftrpatV0jGmFHxDjUv"   # Martin Osborne (biblioteca de ElevenLabs): español de España, maduro y pulido
MODELO_ELEVEN = "eleven_multilingual_v2"
VELOCIDAD = 1.2   # Martin Osborne es pausado; 1,2 es el máximo que admite ElevenLabs
VOZ_EDGE = "es-ES-AlvaroNeural"
COLA = 0.8    # margen final (s)
PUNTUACION_FINAL = tuple(",.;:?!…")

# En las sesiones en la nube el tráfico sale por un proxy con su propia CA.
CA_PROXY = "/root/.ccr/ca-bundle.crt"
SSL_CTX = ssl.create_default_context(cafile=CA_PROXY) if os.path.exists(CA_PROXY) else ssl.create_default_context()


def ff(*args):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *args], check=True)


def duracion(ruta):
    return float(subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(ruta)]))


def tokens(frase):
    """Separa una frase en palabras; las que van entre *asteriscos* son clave (salen en blanco)."""
    salida, abierto = [], False
    for bruto in frase.split():
        nucleo = bruto.lstrip("¿¡«(\"")
        empieza = nucleo.startswith("*")
        clave = abierto or empieza
        abierto = abierto or empieza
        if bruto.rstrip(".,;:?!…»)\"").endswith("*") and (len(nucleo.strip("*.,;:?!…»)\"")) > 0):
            abierto = False
        salida.append({"w": bruto.replace("*", ""), "clave": clave})
    return salida


# ---------- voz ----------
def voz_elevenlabs(texto, destino):
    """Devuelve (caracteres, tiempo de inicio de cada carácter) usando el endpoint con marcas de tiempo."""
    cuerpo = {"text": texto, "model_id": MODELO_ELEVEN,
              "voice_settings": {"stability": 0.45, "similarity_boost": 0.8, "style": 0.15, "use_speaker_boost": True, "speed": VELOCIDAD}}
    pet = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{VOZ_ELEVEN}/with-timestamps?output_format=mp3_44100_128",
        data=json.dumps(cuerpo).encode(), headers={"xi-api-key": os.environ["ELEVENLABS_API_KEY"], "Content-Type": "application/json"})
    with urllib.request.urlopen(pet, context=SSL_CTX, timeout=180) as r:
        datos = json.load(r)
    Path(destino).write_bytes(base64.b64decode(datos["audio_base64"]))
    al = datos["alignment"]
    return "".join(al["characters"]), al["character_start_times_seconds"]


async def voz_edge(texto, destino):
    try:
        import edge_tts
    except ImportError:
        subprocess.run([sys.executable, "-m", "pip", "install", "-q", "edge-tts"], check=True)
        import edge_tts
    import edge_tts.communicate as communicate
    communicate._SSL_CTX = SSL_CTX
    com = edge_tts.Communicate(texto, VOZ_EDGE, rate="+8%", boundary="WordBoundary")
    tiempos, cursor = [None] * len(texto), 0
    with open(destino, "wb") as f:
        async for trozo in com.stream():
            if trozo["type"] == "audio":
                f.write(trozo["data"])
            elif trozo["type"] == "WordBoundary":
                i = texto.find(trozo["text"], cursor)
                if i >= 0:
                    for j in range(i, i + len(trozo["text"])):
                        tiempos[j] = trozo["offset"] / 1e7
                    cursor = i + len(trozo["text"])
    ultimo = 0.0
    for j, t in enumerate(tiempos):
        tiempos[j] = ultimo = t if t is not None else ultimo
    return texto, tiempos


def sintetizar(texto, cache):
    """Voz con caché por contenido: (ruta mp3, caracteres alineados, tiempos)."""
    motor = "eleven" if os.environ.get("ELEVENLABS_API_KEY") else "edge"
    clave = hashlib.sha1(f"{motor}|{VOZ_ELEVEN}|{MODELO_ELEVEN}|{VELOCIDAD}|{VOZ_EDGE}|{texto}".encode()).hexdigest()[:16]
    mp3, meta = cache / f"{clave}.mp3", cache / f"{clave}.json"
    nueva = not (mp3.exists() and meta.exists())
    if nueva:
        chars, tiempos = voz_elevenlabs(texto, mp3) if motor == "eleven" else asyncio.run(voz_edge(texto, mp3))
        meta.write_text(json.dumps({"chars": chars, "tiempos": tiempos}, ensure_ascii=False))
    m = json.loads(meta.read_text())
    print(f"  voz: {motor}, {len(texto)} caracteres ({'generada' if nueva else 'de caché, gratis'})")
    return mp3, m["chars"], m["tiempos"]


def tiempo_de_caracteres(texto, chars, tiempos):
    """Tiempo de cada carácter de `texto`, aunque la alineación devuelta no coincida letra a letra."""
    res, sm = [None] * len(texto), difflib.SequenceMatcher(None, texto, chars, autojunk=False)
    for a, b, n in sm.get_matching_blocks():
        for k in range(n):
            res[a + k] = tiempos[b + k]
    ultimo = 0.0
    for i, t in enumerate(res):
        res[i] = ultimo = t if t is not None else ultimo
    return res


# ---------- timeline ----------
def construir_timeline(guion, chars, tiempos, total):
    frases_tok = [tokens(f) for f in guion["frases"]]
    texto = " ".join(" ".join(t["w"] for t in ft) for ft in frases_tok)
    tc = tiempo_de_caracteres(texto, chars, tiempos)
    pos = 0
    for ft in frases_tok:
        for t in ft:
            primero = next((pos + i for i, c in enumerate(t["w"]) if c.isalnum()), pos)
            t["t"] = round(tc[primero], 3)
            pos += len(t["w"]) + 1
    frases = []
    for i, ft in enumerate(frases_tok):
        inicio = 0.0 if i == 0 else max(0.0, ft[0]["t"] - 0.08)
        frases.append({"inicio": round(inicio, 3), "texto": " ".join(t["w"] for t in ft), "palabras": ft})
    for i, f in enumerate(frases):
        f["fin"] = frases[i + 1]["inicio"] if i + 1 < len(frases) else round(total, 3)

    subs = []
    for f in frases:
        grupo = []
        for t in f["palabras"]:
            grupo.append(t)
            if t["w"].endswith(PUNTUACION_FINAL) or len(grupo) >= 4 or sum(len(x["w"]) + 1 for x in grupo) >= 22:
                subs.append(grupo)
                grupo = []
        if grupo:
            subs.append(grupo)
    subs = [{"ini": 0.0 if i == 0 else g[0]["t"], "palabras": g} for i, g in enumerate(subs)]
    for i, s in enumerate(subs):
        s["fin"] = subs[i + 1]["ini"] if i + 1 < len(subs) else round(total, 3)
    return {"id": guion["id"], "duracion": round(total, 3), "frases": frases, "subs": subs}


def medir_previa(carpeta, timeline):
    """Lo que un vistazo no mide bien: cuánto ocupa lo importante en la zona principal y si el plano está lavado."""
    print("  medición (zona principal, y 460-1440): cobertura = parte del cuadro con algo visible")
    visible = bytes(int(v >= 40) for v in range(256))   # el fondo queda por debajo de 40; un objeto oscuro bien iluminado, por encima
    for i, f in enumerate(sorted(carpeta.glob("*.jpg"))):
        gris = subprocess.check_output(["ffmpeg", "-v", "error", "-i", str(f), "-vf", "crop=1080:980:0:460,format=gray",
                                        "-f", "rawvideo", "-"])
        cobertura, media = gris.translate(visible).count(1) / len(gris), sum(gris) / len(gris)
        avisos = (["CASI VACÍO: el objeto ocupa muy poco"] if cobertura < 0.15 else []) + (["MUY CLARO: puede lavar el plano"] if media > 150 else [])
        print(f"    frase {i:2d}: cobertura {cobertura:4.0%}, brillo {media:3.0f}  {' · '.join(avisos)}  «{timeline['frases'][i]['texto'][:40]}»")


def main(ruta_guion, previa):
    guion = json.loads(Path(ruta_guion).read_text(encoding="utf-8"))
    vid = guion["id"]
    if not (RAIZ / "escenas" / f"{vid}.js").exists():
        sys.exit(f"Falta escenas/{vid}.js")
    salida = RAIZ / "out"
    cache = salida / "cache"
    cache.mkdir(parents=True, exist_ok=True)
    tmp = Path(tempfile.mkdtemp(prefix=f"{vid}-"))

    texto = " ".join(" ".join(t["w"] for t in tokens(f)) for f in guion["frases"])
    mp3, chars, tiempos = sintetizar(texto, cache)
    audio = tmp / "audio.wav"
    ff("-i", str(mp3), "-af", f"apad=pad_dur={COLA},loudnorm=I=-14:TP=-1.5:LRA=11", "-ar", "48000", "-ac", "1", str(audio))
    timeline = construir_timeline(guion, chars, tiempos, duracion(audio))
    ruta_tl = tmp / "timeline.json"
    ruta_tl.write_text(json.dumps(timeline, ensure_ascii=False), encoding="utf-8")

    render = ["node", str(RAIZ / "pipeline" / "render.cjs"), str(ruta_tl)]
    if previa:
        subprocess.run(render + ["--previa", str(salida / f"{vid}-previa.jpg")], check=True)
        medir_previa(salida / f"{vid}-previa", timeline)
        return
    mp4 = salida / f"{vid}.mp4"
    subprocess.run(render + [str(audio), str(mp4)], check=True)
    (salida / f"{vid}.txt").write_text(guion["caption"].strip() + "\n\n" + " ".join(guion.get("hashtags", [])) + "\n", encoding="utf-8")
    print(f"OK {mp4} ({timeline['duracion']:.1f} s)")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) != 1:
        sys.exit(__doc__)
    main(args[0], "--previa" in sys.argv)
