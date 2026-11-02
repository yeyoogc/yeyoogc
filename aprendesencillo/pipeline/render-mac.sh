#!/bin/sh
# Renderiza en el Mac, con su tarjeta gráfica, el último vídeo preparado (o el que digas: render-mac.sh <id>).
# Trae lo nuevo del repo, renderiza (3D al 100 % y MSAA 4×, ~3 min en un M5), abre el vídeo y copia el texto de TikTok.
# Una vez: brew install node ffmpeg
set -e
cd "$(dirname "$0")/.."
git pull -q --ff-only
ID="${1:-$(cat entregas/ultimo.txt)}"
[ -f "entregas/$ID/timeline.json" ] || { echo "No hay paquete para $ID en entregas/"; exit 1; }
[ -d node_modules/playwright ] || { npm install --no-save playwright@1.63.0 && npx playwright install chromium; }
mkdir -p out
echo "Renderizando $ID…"
node pipeline/render.cjs "entregas/$ID/timeline.json" "entregas/$ID/voz.m4a" "out/$ID.mp4"
pbcopy < "entregas/$ID/texto.txt" && echo "Texto de TikTok copiado al portapapeles."
open "out/$ID.mp4"
