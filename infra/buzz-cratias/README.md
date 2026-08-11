# Buzz para Cratias Asesores

Despliegue del espacio de trabajo [Buzz](https://github.com/block/buzz) (Block, Inc., Apache 2.0)
para el equipo del despacho: un **relay propio** en un servidor nuestro y la **app de escritorio**
en el ordenador de cada persona.

> **Esto no forma parte de la aplicación KratCom.** Es infraestructura del despacho y vive aquí
> solo por comodidad. Si el despliegue sale adelante, lo suyo es moverlo a su propio repositorio.

---

## Antes de nada: en qué te estás metiendo

Buzz es software **pre-1.0 en desarrollo activo**. La última versión de escritorio en el momento
de escribir esto es `desktop-v0.5.9`, publicada el 10 de agosto de 2026. Conviene tenerlo claro
antes de meter dentro las conversaciones del despacho:

- El propio proyecto declara en `SECURITY.md` que **no mantiene ramas de soporte** y que todos los
  parches de seguridad aterrizan primero en `main`. Actualizar no será opcional.
- El instalador de Windows **no está firmado** (el fichero se llama literalmente
  `..._alpha-unsigned.exe`), así que SmartScreen avisará en la primera ejecución.
- Funciones que un despacho podría dar por hechas siguen sin terminar: las **notificaciones push**
  y los **clientes móviles** están en la columna de «pendiente» del README oficial.
- El modelo multi-tenant está formalmente especificado, pero en la versión de hoy **la frontera de
  seguridad es el proceso del relay**: un relay, una comunidad. Para nosotros vale — queremos
  exactamente un espacio, el del despacho.

Recomendación: empezar con un canal interno no crítico durante unas semanas antes de mover ahí
nada que tenga que ver con expedientes de clientes.

### Los agentes se ejecutan en el portátil, no en el servidor

Conviene tenerlo claro antes de repartir la app por el despacho, porque es el punto donde Buzz
toca ficheros reales.

**El relay del VPS no alcanza a los ordenadores del despacho.** Solo almacena y reparte eventos
firmados; la conexión la abre siempre el portátil hacia el servidor, nunca al revés.

**Los agentes de IA, en cambio, se ejecutan en la máquina de quien los crea**, no en el relay
(`desktop/src-tauri/src/managed_agents/`, «local spawn»). Tienen una herramienta de shell que
ejecuta órdenes de verdad — por eso el README oficial exige Git for Windows: la app resuelve Git
Bash en tiempo de ejecución. Por defecto trabajan en un espacio propio (`~/.buzz`, el «nest»), pero
el usuario puede apuntarlos a carpetas locales existentes mediante `repos_dir`. No hay
confinamiento general: existe algún aislamiento heredado del harness concreto (Codex usa Seatbelt
en macOS), pero no es una garantía del producto.

**El ajuste crítico es «Respond to»**, que decide quién puede dar órdenes a un agente:

| Opción | Efecto |
|---|---|
| `Only me` (por defecto) | Solo el dueño y sus propios agentes verificados |
| `Anyone` | Cualquiera del relay puede instruirlo |
| `Selected people` | Una lista concreta de personas |

Las dos últimas, en palabras del propio código, «comparten el acceso del anfitrión con alguien que
no es él»: un mensaje en un canal pasa a ejecutar órdenes en el ordenador de quien creó el agente.
El candado de compilación que fuerza `owner-only` (`BUZZ_BUILD_AGENT_ACCESS_OWNER_ONLY`) **no está
activado en la build pública** — solo aparece en recetas de test del `Justfile` —, así que en la
versión que se descarga las tres opciones funcionan.

Reglas mínimas para el despacho:

1. **Nadie cambia `Only me`.** Que conste por escrito.
2. **No apuntar agentes a carpetas con expedientes.** Que trabajen en su nest aislado.
3. Mantener el relay cerrado y dar de baja a quien salga del despacho.

### Nota de protección de datos

Si en Buzz se van a tratar datos de clientes, el servidor es un tratamiento más:

- Aloja el VPS **en la UE** y firma el encargo de tratamiento con el proveedor (art. 28 RGPD).
- El relay cerrado (`BUZZ_REQUIRE_RELAY_MEMBERSHIP=true`, que este bootstrap deja activado) es lo
  que impide que cualquiera con la URL entre. No lo desactives.
- Las copias de seguridad contienen conversaciones: cífralas y aplícales el mismo plazo de
  conservación que al resto de documentación del despacho.
- Da de baja a quien salga del despacho con `./run.sh remove-member`.

---

## Arquitectura

```
Portátiles del equipo                    VPS del despacho (UE)
┌──────────────────┐                    ┌──────────────────────────────┐
│ App Buzz         │   wss://           │  Caddy  (HTTPS, Let's Encrypt)│
│ (Mac / Windows)  │ ─────────────────► │    └── relay (Rust)           │
│ clave Nostr      │   buzz.cratias.es  │          ├── Postgres  eventos│
│ propia por       │                    │          ├── Redis     pub/sub│
│ persona          │                    │          └── MinIO     ficheros│
└──────────────────┘                    └──────────────────────────────┘
```

Cada persona tiene un par de claves Nostr. La pubkey (`npub1...`) es su identidad; el relay solo
acepta a quien esté en el listado de miembros.

---

## Qué necesitas

- Un **VPS en la UE**: 2 vCPU, 4 GB de RAM y 40 GB de disco como punto de partida razonable para
  un equipo pequeño (estimación: son cinco contenedores, con Postgres y MinIO dentro; ajústalo
  al alza si se suben muchos ficheros).
- **Docker** con **Docker Compose v2.24.4 o superior**. La configuración con TLS usa la etiqueta
  `!reset` de Compose, que no existe en versiones anteriores.
- Un **subdominio con DNS apuntando al VPS** (p. ej. `buzz.cratias.es`). Hace falta antes de
  arrancar: Let's Encrypt valida contra él.
- Los puertos **80 y 443** abiertos.

### Alternativa sin servidor

Block ofrece un despliegue en Railway a un clic desde el README del proyecto. Es más rápido de
montar, pero el relay queda alojado en infraestructura de terceros; para datos de clientes, el VPS
propio en la UE es la opción defendible.

---

## Despliegue paso a paso

### 1. Clonar Buzz en el servidor

```bash
sudo mkdir -p /opt && cd /opt
git clone https://github.com/block/buzz.git
```

### 2. Obtener la clave del socio administrador

Instala la app de escritorio en tu equipo (ver más abajo), ábrela y ve a **Ajustes → Perfil**:
despliega la sección de identidad y copia el valor de **«Public key»** con su botón de copiar. Ese
será el propietario del relay. El script acepta tanto el formato `npub1...` como el hexadecimal.

Si prefieres que el servidor genere la identidad, omite `--propietario` en el paso siguiente: el
script creará el par de claves y te mostrará la privada **una sola vez**.

### 3. Generar la configuración

Copia a la carpeta `infra/buzz-cratias/` de este repositorio en el servidor y ejecuta:

```bash
./bootstrap.sh \
  --dominio buzz.cratias.es \
  --propietario npub1tu_clave_aqui \
  --repo /opt/buzz
```

Esto escribe `/opt/buzz/deploy/compose/.env` con permisos `600` y genera de una vez todos los
secretos estables: clave del relay, HMAC de los hooks de git, y contraseñas de Postgres, Redis y
MinIO. (El README de Buzz menciona un script de bootstrap que todavía no existe en el repositorio;
este lo sustituye.)

Todos los secretos se generan en hexadecimal a propósito: acaban dentro de `DATABASE_URL` y
`REDIS_URL`, y un carácter especial rompería esas URLs.

### 4. Validar antes de arrancar

```bash
cd /opt/buzz/deploy/compose
./run.sh config      # debe terminar sin errores
```

### 5. Arrancar con HTTPS

```bash
BUZZ_COMPOSE_TLS=true ./run.sh start
```

**Usa siempre `BUZZ_COMPOSE_TLS=true`.** Sin esa variable, Compose publica el relay directamente en
el puerto 3000 en claro; con ella, solo salen el 80 y el 443 a través de Caddy y el 3000 deja de
exponerse. Está comprobado sobre la configuración renderizada.

Comprobación de que está vivo:

```bash
curl -fsS https://buzz.cratias.es/_liveness
./run.sh status
```

### 6. Dar de alta al equipo

Una vez cada persona tenga la app instalada y te pase su `npub1...`:

```bash
./run.sh add-member npub1xxxx --role member
./run.sh add-member npub1yyyy --role admin
./run.sh list-members
```

Si añades varias personas seguidas, **deja un segundo entre una y otra**. El listado de miembros es
un evento Nostr con marca de tiempo en segundos y dos altas en el mismo segundo colisionan. Por lo
mismo, nada de paralelizarlo.

---

## Instalación en los equipos del despacho

Descarga desde [la última release](https://github.com/block/buzz/releases/latest):

| Equipo | Fichero |
|---|---|
| Mac con Apple Silicon (M1–M4) | `Buzz_<versión>_aarch64.dmg` |
| Mac con Intel | `Buzz_<versión>_x64.dmg` |
| Windows | `Buzz_<versión>_x64-setup_alpha-unsigned.exe` |
| Linux | `Buzz_<versión>_amd64.AppImage` o `.deb` |

Para saber qué Mac es: menú Apple → Acerca de este Mac. «Chip: Apple…» es Apple Silicon.

En Windows, SmartScreen mostrará «Windows protegió su PC» porque el instalador no está firmado:
**Más información → Ejecutar de todas formas**. En Windows hace falta además
[Git for Windows](https://git-scm.com/download/win), porque la app resuelve Git Bash en tiempo de
ejecución.

Al abrirla por primera vez apunta al relay del despacho: la app trae `ws://localhost:3000` por
defecto, así que hay que cambiarlo a `wss://buzz.cratias.es` desde la propia app, o lanzarla con la
variable `BUZZ_RELAY_URL`.

> **Que cada persona haga copia de su clave privada.** En **Ajustes → Perfil**, la misma sección de
> identidad donde está la «Public key» permite revelar y respaldar la clave privada. Esa clave *es*
> su identidad: si la pierde, pierde el acceso y hay que darla de alta de nuevo como miembro
> distinto.

---

## Copias de seguridad

`./run.sh backup-hint` imprime la lista oficial. En resumen, hay que respaldar:

- `deploy/compose/.env` — **el fichero más crítico**. Sin él, la base de datos y los ficheros ya
  guardados quedan inservibles.
- La clave privada del propietario, si la generó el bootstrap.
- Postgres, preferiblemente con `pg_dump`.
- El contenido del bucket de MinIO (ficheros y objetos de git).
- El volumen `buzz-git-data`.

Los snapshots de Postgres y de los ficheros deben ser **de la misma ventana de mantenimiento**, o
quedarán descuadrados entre sí.

## Actualizaciones

```bash
cd /opt/buzz/deploy/compose
./run.sh upgrade      # pull + reinicio + recordatorio de backups
```

El `.env` que genera este bootstrap deja `BUZZ_IMAGE=ghcr.io/block/buzz:main`, que es la rama de
desarrollo. **Para producción, fíjalo a una versión concreta** (`ghcr.io/block/buzz:sha-<7>`) y
sube de versión a propósito, no por sorpresa en cada reinicio.

---

## Ficheros de esta carpeta

| Fichero | Para qué sirve |
|---|---|
| `bootstrap.sh` | Genera `deploy/compose/.env` con todos los secretos estables |
| `nostrkey.py` | Claves Nostr y conversión `npub1...` → hex, sin dependencias externas |

## Estado de la verificación

Sobre este entorno se ha comprobado que:

- `nostrkey.py` deriva correctamente la pubkey (contrastado con el vector `k=1` → punto G) y
  descodifica `npub` contra el vector de ejemplo de la NIP-19, rechazando checksums inválidos.
- `bootstrap.sh` genera un `.env` que `docker compose config` renderiza **sin errores y sin ningún
  marcador `CHANGE_ME`** pendiente, con `DATABASE_URL`, `REDIS_URL` y `RELAY_OWNER_PUBKEY` bien
  formados.
- Con `BUZZ_COMPOSE_TLS=true` solo se publican los puertos 80 y 443; sin esa variable se publica el
  3000 en claro.

**No se ha podido arrancar el stack**: la política de red de este entorno bloquea la descarga de
imágenes tanto de Docker Hub como de ghcr.io. Los pasos 5 y 6 salen de los propios scripts del
repositorio, pero conviene ejecutarlos primero en un VPS de pruebas.
