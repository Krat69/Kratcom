#!/usr/bin/env bash
# Genera el fichero .env del relay Buzz de Cratias Asesores.
#
# El repositorio de Buzz documenta un "bootstrap script" que todavía no existe
# (deploy/compose/README.md), así que este cubre ese hueco: genera todos los
# secretos estables de una sola vez y deja el .env listo para ./run.sh start.
#
# Uso:
#   ./bootstrap.sh --dominio buzz.cratias.es --propietario npub1xxxx --repo /opt/buzz
#
# Si omites --propietario, genera un par de claves nuevo y te muestra la clave
# privada UNA sola vez para que la guardes en el gestor de contraseñas.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KEYTOOL="${SCRIPT_DIR}/nostrkey.py"

DOMINIO=""
PROPIETARIO=""
REPO=""
IMAGEN="ghcr.io/block/buzz:main"
FORCE="false"

uso() {
  cat <<'MSG'
Uso: ./bootstrap.sh --dominio <host> [opciones]

Obligatorio:
  --dominio <host>        Nombre público del relay (p. ej. buzz.cratias.es)

Opcional:
  --propietario <clave>   npub1... o hex de 64 caracteres del socio administrador.
                          Si se omite, se genera un par de claves nuevo.
  --repo <ruta>           Ruta del clon de block/buzz. Por defecto se busca
                          deploy/compose junto a este script o en el directorio actual.
  --imagen <ref>          Imagen del relay (por defecto ghcr.io/block/buzz:main).
                          En producción conviene fijarla a ghcr.io/block/buzz:sha-<7>.
  --force                 Sobrescribe un .env existente (¡rota todos los secretos!).
MSG
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dominio)     DOMINIO="${2:?falta el valor de --dominio}"; shift 2 ;;
    --propietario) PROPIETARIO="${2:?falta el valor de --propietario}"; shift 2 ;;
    --repo)        REPO="${2:?falta el valor de --repo}"; shift 2 ;;
    --imagen)      IMAGEN="${2:?falta el valor de --imagen}"; shift 2 ;;
    --force)       FORCE="true"; shift ;;
    -h|--help)     uso; exit 0 ;;
    *) echo "Opción desconocida: $1" >&2; uso >&2; exit 2 ;;
  esac
done

[[ -n "$DOMINIO" ]] || { echo "ERROR: falta --dominio" >&2; uso >&2; exit 2; }
command -v openssl >/dev/null || { echo "ERROR: hace falta openssl" >&2; exit 1; }
command -v python3 >/dev/null || { echo "ERROR: hace falta python3" >&2; exit 1; }
[[ -f "$KEYTOOL" ]] || { echo "ERROR: no encuentro nostrkey.py junto a este script" >&2; exit 1; }

# Localiza deploy/compose dentro del clon de Buzz.
if [[ -n "$REPO" ]]; then
  DESTINO="${REPO%/}/deploy/compose"
elif [[ -f "./compose.yml" && -f "./run.sh" ]]; then
  DESTINO="$(pwd)"
elif [[ -f "./deploy/compose/compose.yml" ]]; then
  DESTINO="$(pwd)/deploy/compose"
else
  echo "ERROR: no encuentro deploy/compose. Indica el clon con --repo /ruta/buzz" >&2
  exit 1
fi
[[ -f "${DESTINO}/compose.yml" ]] || { echo "ERROR: ${DESTINO} no parece el bundle de compose de Buzz" >&2; exit 1; }

ENV_FILE="${DESTINO}/.env"
if [[ -f "$ENV_FILE" && "$FORCE" != "true" ]]; then
  echo "ERROR: ya existe ${ENV_FILE}." >&2
  echo "Regenerarlo rota los secretos y deja inaccesibles la base de datos y los ficheros ya guardados." >&2
  echo "Si de verdad quieres reemplazarlo, haz copia de seguridad y vuelve a ejecutar con --force." >&2
  exit 1
fi

# --- Identidad del propietario -------------------------------------------
PRIV_GENERADA=""
if [[ -n "$PROPIETARIO" ]]; then
  if ! OWNER_PUB="$(python3 "$KEYTOOL" tohex "$PROPIETARIO" 2>&1)"; then
    echo "${OWNER_PUB}" >&2
    echo "Revisa el valor de --propietario: debe ser el npub1... que muestra la app en Ajustes." >&2
    exit 1
  fi
else
  read -r PRIV_GENERADA OWNER_PUB <<<"$(python3 "$KEYTOOL" gen)"
fi

# --- Secretos estables ----------------------------------------------------
# Todo en hexadecimal: estas contraseñas viajan dentro de DATABASE_URL y
# REDIS_URL, así que no pueden contener caracteres que rompan una URL.
RELAY_PRIV="$(python3 "$KEYTOOL" priv)"
GIT_HMAC="$(openssl rand -hex 32)"
PG_PASS="$(openssl rand -hex 24)"
REDIS_PASS="$(openssl rand -hex 24)"
S3_ACCESS="$(openssl rand -hex 12)"
S3_SECRET="$(openssl rand -hex 24)"

umask 077
cat > "$ENV_FILE" <<EOF
# Relay Buzz — Cratias Asesores SLP
# Generado por infra/buzz-cratias/bootstrap.sh. Contiene secretos: chmod 600, nunca a git.
#
# COPIA DE SEGURIDAD OBLIGATORIA de este fichero. Sin él, la base de datos, los
# ficheros de MinIO y la identidad del relay quedan inservibles.

BUZZ_IMAGE=${IMAGEN}

# Nombre público. El relay va por WSS, así que el dominio necesita HTTPS válido.
BUZZ_DOMAIN=${DOMINIO}
RELAY_URL=wss://${DOMINIO}
BUZZ_MEDIA_BASE_URL=https://${DOMINIO}/media
BUZZ_MEDIA_SERVER_DOMAIN=${DOMINIO}
BUZZ_CORS_ORIGINS=https://${DOMINIO}

# Relay cerrado: solo entra quien esté en el listado de miembros.
# Imprescindible en un despacho — sin esto, cualquiera con la URL entra.
BUZZ_REQUIRE_AUTH_TOKEN=true
BUZZ_REQUIRE_RELAY_MEMBERSHIP=true
BUZZ_ALLOW_NIP_OA_AUTH=true
BUZZ_AUTO_MIGRATE=true
BUZZ_GIT_CONFORMANCE_PROBE=true
RUST_LOG=buzz_relay=info,buzz_db=info,buzz_auth=info,buzz_pubsub=info,tower_http=info

# Socio administrador del relay.
RELAY_OWNER_PUBKEY=${OWNER_PUB}

# Secretos estables: no deben cambiar entre reinicios.
BUZZ_RELAY_PRIVATE_KEY=${RELAY_PRIV}
BUZZ_GIT_HOOK_HMAC_SECRET=${GIT_HMAC}
POSTGRES_DB=buzz
POSTGRES_USER=buzz
POSTGRES_PASSWORD=${PG_PASS}
REDIS_PASSWORD=${REDIS_PASS}
BUZZ_S3_ACCESS_KEY=${S3_ACCESS}
BUZZ_S3_SECRET_KEY=${S3_SECRET}
BUZZ_S3_BUCKET=buzz-media
BUZZ_S3_ADDRESSING_STYLE=path

# Puertos. Con Caddy (BUZZ_COMPOSE_TLS=true) el relay deja de publicarse directo.
BUZZ_HTTP_PORT=3000
CADDY_HTTP_PORT=80
CADDY_HTTPS_PORT=443

# Solo se usan con compose.dev.yml. No abrir en producción.
POSTGRES_PORT=5432
REDIS_PORT=6379
MINIO_API_PORT=9000
MINIO_CONSOLE_PORT=9001
ADMINER_PORT=8082
PROMETHEUS_PORT=9090
EOF
chmod 600 "$ENV_FILE"

echo "Escrito ${ENV_FILE} (permisos 600)."
echo
echo "  Dominio             : ${DOMINIO}"
echo "  URL del relay       : wss://${DOMINIO}"
echo "  Pubkey propietario  : ${OWNER_PUB}"
echo "  Imagen              : ${IMAGEN}"

if [[ -n "$PRIV_GENERADA" ]]; then
  cat <<EOF

=====================================================================
 CLAVE PRIVADA DEL PROPIETARIO — SE MUESTRA UNA SOLA VEZ
 ${PRIV_GENERADA}
 Guárdala AHORA en el gestor de contraseñas del despacho.
 Quien la tenga es el administrador del relay. No se puede recuperar.
=====================================================================
EOF
fi

cat <<EOF

Siguientes pasos, desde ${DESTINO}:
  1. Revisa el .env
  2. ./run.sh config                      # valida la configuración sin arrancar nada
  3. BUZZ_COMPOSE_TLS=true ./run.sh start # arranca con HTTPS automático (Let's Encrypt)
  4. ./run.sh add-member <npub> --role member   # uno por cada persona del despacho
EOF
