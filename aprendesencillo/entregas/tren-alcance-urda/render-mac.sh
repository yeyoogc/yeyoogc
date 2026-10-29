#!/bin/sh
# Renderiza este vídeo en un Mac con su tarjeta gráfica (3D al 100 % y MSAA 4×). Necesita node y ffmpeg: brew install node ffmpeg
set -e
cd "$(dirname "$0")/../.."
[ -d node_modules/playwright ] || { npm install --no-save playwright@1.63.0 && npx playwright install chromium; }
mkdir -p out
node pipeline/render.cjs entregas/tren-alcance-urda/timeline.json entregas/tren-alcance-urda/voz.m4a out/tren-alcance-urda.mp4
open out/tren-alcance-urda.mp4
