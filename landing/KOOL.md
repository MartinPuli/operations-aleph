# Kool: descarga desde la landing

Conexión **Warden**: `cmtvdbpti0003l804xkhkkcl3` · [Conexiones en Kool](https://app.joinkool.co/dashboard/settings).

Evento registrado: **Descarga desde la landing (clic)**, clave `landing_download_clicked`, origen `BROWSER`.

La condición es la activación real de un enlace que apunta al instalador oficial de macOS o Windows: cabecera, hero, plataforma alternativa o pie de página. Un clic mide la intención de descargar; no confirma archivo completo, instalación ni primera apertura. Abrir Releases/Linux, navegar a una sección o cargar la página no cuenta.

## Estado verificado

- Registrado en el catálogo de Warden; ID `cmtvdigdm0001kt04umsnot5r`.
- Prueba real desde la landing local, pulsando `Download for macOS`, recibida por Kool el **10 de septiembre de 2026 a las 10:28:38 UTC**. El endpoint propio respondió HTTP 200 y `kool events inspect --key landing_download_clicked` confirmó `lastTestAt: 2026-09-10T10:28:38.153Z`.
- Segunda prueba desde el botón `Windows x64 · .exe`: HTTP 200; Kool confirmó `lastTestAt: 2026-09-10T10:30:35.594Z`.
- Al integrar sobre la landing actual de `main` (**Your AI. Your rules.**), se repitió el clic de cabecera: HTTP 200 y `lastTestAt: 2026-09-10T10:36:00.534Z`. Cargar esa versión no emitió conversiones.
- La prueba usó `test: true` y no generó recompensas. El archivo del instalador se sustituyó por una respuesta vacía sólo dentro del navegador de QA para evitar descargarlo completo; el clic, el código de la landing, el backend y el envío a Kool fueron reales.
- Carga inicial y navegación a `How it works`: cero solicitudes de conversión en el navegador. Las pruebas automatizadas también cubren clics sintéticos, botón derecho y enlaces no elegibles.
- **45 pruebas pasan**: 20 nuevas de Kool y 25 existentes de analytics/descargas.
- La conservación y expiración de `kool_cid`, incluido almacenamiento bloqueado o de sólo lectura, están verificadas con referencias de prueba. La recepción real indicada arriba fue sin atribución: no se proporcionó un link vigente de campaña para verificar la asociación con un creator.
- **Estado actual en Kool: `ENABLED`**, observado al consultar la prueba de integración sobre `main`. Antes se había dejado la habilitación pendiente por indicación del usuario; cambió fuera de este trabajo. No se creó ni modificó una campaña ni una recompensa.
- **Despliegue pendiente.** El código y la credencial renovada están preparados localmente; esto no representa una integración publicada en producción.

La autorización inicial se revocó o venció durante la verificación. Se renovó mediante el CLI y autorización del usuario; después se repitió el clic y se confirmó su recepción. El fallo anterior devolvió un error acotado y no bloqueó la navegación del botón.

## Flujo y privacidad

`kool-entry.js` inicializa un módulo independiente de PostHog. El helper oficial `@joinkool/sdk/browser` conserva sólo el último `kool_cid` válido hasta 90 días. No conserva la URL ni otros parámetros. Se respeta Do Not Track; si el almacenamiento falla, un link actual puede atribuirse en esa página sin garantizar persistencia.

Un clic real genera un UUID v4 y una petición `POST /api/kool-download` con `{eventId, platform, clickId?}`. Se mantiene el enlace nativo, con `keepalive`, sin cookies ni referrer. La atribución queda asociada a ese resultado antes del envío.

El backend valida método, origen, host, tamaño, UUID, plataforma y una lista estricta de campos. Envía a Kool exclusivamente `{event: "landing_download_clicked", eventId, clickId?, test}`. No envía plataforma, ubicación del botón, nombre, email, teléfono, formularios, perfiles, texto de la página, IP del visitante, user-agent ni propiedades libres. No registra cuerpos de solicitudes ni secretos en logs.

`@joinkool/sdk/server` reintenta fallos transitorios con el mismo ID y cuerpo. No hay una cola persistente después de agotar esos intentos. Un fallo de medición no bloquea la descarga. Las activaciones repetidas por la persona son clics distintos; esto no mide personas únicas y una señal de navegador no demuestra instalación ni evita por sí sola tráfico automatizado.

## Ejecutar y repetir la prueba

Se requiere Node 22 o posterior. El SDK se instala desde el paquete oficial de Kool y queda fijado por integridad en `integrations/kool/package-lock.json`, separado de las dependencias desktop.

```sh
npm run landing:prepare
# Sólo en un checkout nuevo, antes de exportar la clave:
kool init --connection cmtvdbpti0003l804xkhkkcl3 --api https://app.joinkool.co --project .
# Si todavía no existe el archivo privado del backend:
kool env --output .env.kool.local
npm run landing:dev
```

Abrir `http://127.0.0.1:4173/`, verificar que no se envían conversiones al cargar, y tocar un botón de descarga. El servidor local fuerza modo de prueba. Si hay un link vigente de Kool, usar su `kool_cid` en la landing de prueba para verificar la atribución completa; no inventar una referencia como prueba de una campaña real.

```sh
kool events inspect --key landing_download_clicked
npm run test:landing:kool
node --test scripts/landing-analytics.test.mjs scripts/release-downloads.test.mjs
```

Cuando `kool` no esté instalado, usar el ejecutable del CLI indicado en `.kool/mcp.json`, o `npx --yes --package https://app.joinkool.co/scripts/kool-cli.tgz kool`.

No leer ni imprimir `.env.kool.local` ni `credentials.json`. El CLI exporta el archivo privado con permisos 0600, fuera de Git; `.vercelignore` impide cargar archivos `.env*` y el estado local de los agentes.

## Pasos pendientes para una campaña

1. Desplegar los archivos de la landing, la función y su configuración Vercel. La salida pública recibe sólo el helper de atribución del SDK. La función importa el SDK de servidor desde `integrations/kool/`.
2. Cargar `KOOL_API_URL=https://app.joinkool.co` y `KOOL_INGEST_TOKEN` en las variables privadas del backend de Vercel, por un canal de secretos. La clave nunca debe usar un prefijo público, ir en argumentos ni quedar dentro de la landing.
3. Mantener `KOOL_TEST_MODE=true` al verificar el despliegue. Repetir el clic con el link real de campaña y comprobar la recepción en Kool.
4. En **Conexiones → Warden**, comprobar que **Descarga desde la landing (clic)** sigue habilitado; en la última consulta figuraba `ENABLED`. Puede elegirse en una campaña. No se configuró ninguna regla ni recompensa.
5. Para emitir conversiones reales en producción, configurar explícitamente `KOOL_TEST_MODE=false`. El backend exige además `VERCEL_ENV=production`; previews y desarrollo siguen enviando pruebas. Los parámetros del navegador no pueden cambiar este modo.

El origen público permitido es `https://warden-theta.vercel.app`; los previews se admiten sólo con su `VERCEL_URL` exacta y `VERCEL_ENV=preview`. Si se agrega un dominio propio, actualizar la lista explícita del backend antes de desplegar.
