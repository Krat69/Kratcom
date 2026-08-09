#!/usr/bin/env bash
# Genera llama.xcframework para iOS a partir del submódulo de llama.cpp.
#
# Hay que ejecutarlo UNA vez (y de nuevo al cambiar la versión fijada del
# submódulo) antes de abrir el proyecto en Xcode. Requiere macOS con Xcode.
#
# El artefacto ocupa cientos de MB y no se versiona: está en .gitignore.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
plugin_root="$(dirname "$here")"
llama_dir="$plugin_root/android/src/main/cpp/llama.cpp"
target="$plugin_root/ios/Frameworks/llama.xcframework"

if [[ "$(uname)" != "Darwin" ]]; then
  echo "Este script necesita macOS con Xcode." >&2
  exit 1
fi

if [[ ! -f "$llama_dir/build-xcframework.sh" ]]; then
  echo "Falta el submódulo llama.cpp. Ejecuta: git submodule update --init --recursive" >&2
  exit 1
fi

echo "Compilando llama.xcframework (tarda varios minutos)…"
( cd "$llama_dir" && ./build-xcframework.sh )

built="$llama_dir/build-apple/llama.xcframework"
if [[ ! -d "$built" ]]; then
  echo "El script de llama.cpp no dejó el xcframework donde se esperaba: $built" >&2
  exit 1
fi

rm -rf "$target"
mkdir -p "$(dirname "$target")"
cp -R "$built" "$target"
echo "Listo: $target"
