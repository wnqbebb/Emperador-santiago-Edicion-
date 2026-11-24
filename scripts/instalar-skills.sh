#!/usr/bin/env bash
# Instala en .claude/skills las skills que Claude Code usa para trabajar en Emperador Santiago.
# Versiones fijadas (commit) para que no cambien solas. Uso: bash scripts/instalar-skills.sh [--lemo]
set -euo pipefail
cd "$(dirname "$0")/.."
DEST=.claude/skills
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

fetch() { # repo sha dir
  git init -q "$TMP/$3" && git -C "$TMP/$3" fetch -q --depth 1 "https://github.com/$1" "$2" && git -C "$TMP/$3" checkout -q FETCH_HEAD
}
copy() { # dir/subpath name
  rm -rf "$DEST/$2" && cp -R "$TMP/$1" "$DEST/$2" && echo "  ✓ $2"
}

echo "Descargando skills…"
fetch remotion-dev/skills a3f4098a2afd0e13f6a6f8c8760e275f75457ea9 remotion
fetch heygen-com/hyperframes 2ffa5aeaf84783aacd50d60e6e7e2548c6b3a9b8 hyperframes
fetch JuneYaooo/rea-video fc69e194bdb4da91f72420c58debbc38eee647f5 rea
fetch patch-gg/pixelfx 5294518ce7c72e48b6100a744596e0acf57f2826 pixelfx
fetch anthropics/skills e4bb5d960d87126ff3b3a8af1a104b7db67560ba anthropic
# Las que fija el skills-lock de crear-estilo-edicion
fetch digitalsamba/claude-code-video-toolkit b3437fcd462c23b3c46cfd28f8cb61b71039269b videotoolkit
fetch terminalskills/skills 42289059901710441bfa8081c08c3a9f36b93f9c terminalskills

mkdir -p "$DEST"
for s in "$TMP"/remotion/skills/*/; do copy "remotion/skills/$(basename "$s")" "$(basename "$s")"; done
for s in hyperframes hyperframes-cli hyperframes-registry media-use remotion-to-hyperframes reverse-any-video style-sampling; do copy "hyperframes/skills/$s" "$s"; done
copy rea/skills/rea-video rea-video
copy pixelfx/skills/pixelfx pixelfx
for s in webapp-testing frontend-design mcp-builder skill-creator algorithmic-art; do copy "anthropic/skills/$s" "$s"; done
copy videotoolkit/.claude/skills/ffmpeg ffmpeg
copy terminalskills/skills/gallery-dl gallery-dl
# Edit Studio (Higgsfield) viene dentro de crear-estilo-edicion; edit-gen no se instala (regla 2: nada de IA de pago)
for s in edit-director edit-voice; do rm -rf "$DEST/$s"; cp -R .claude/skills/crear-estilo-edicion/plugins/edit-studio/skills/$s "$DEST/$s" && echo "  ✓ $s"; done

if [[ "${1:-}" == "--lemo" ]]; then
  # 99 estilos de película en código. Licencia CC BY-NC 4.0: solo uso NO comercial.
  fetch lemomo-ai/lemo-opuscar 8ca0dd805e214bcc1d30714cd5b9d21cc02a454b lemo
  copy lemo/plugin/skills/lemo-opuscar lemo-opuscar
  echo "  ⚠ lemo-opuscar es CC BY-NC 4.0: no lo uses para videos que vendas o monetices."
fi
echo "Listo: skills en $DEST (Claude Code las carga al abrir este proyecto)."
