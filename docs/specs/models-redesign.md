# Rediseño de la consola: Models en tabs — Spec técnico

Sigue a `docs/prd/models-redesign.md`. Acá se cierra el cómo: rutas, qué
módulo cambia y qué se reusa tal cual, el destino del copy actual, y qué
verificar. Las decisiones de producto del PRD (§4) son insumo fijo.

Todas las referencias `archivo:línea` son al estado del repo al 2026-09-08
(main en `a739225`). Los frames de Figma citados viven en el archivo
"Warden" (`RFPKLtSSZjQMHy9XaOOSqp`), página Console.

**Coordinación con `docs/specs/rules-redesign.md`** (implementable en
cualquier orden, por agentes distintos): dos piezas son compartidas — (a)
el CSS del estado activo del topnav (subrayado, §6 acá y §7 allá: misma
definición en ambos; el que llegue primero lo implementa, el segundo
verifica que ya esté y no lo duplica) y (b) el destino del botón "Try a
document": este spec **borra** la sección que lo contiene en Models; el de
Rules **crea** su nuevo hogar (la tab Test). Si este spec se implementa
primero, entre ambos merges el tester sigue accesible por `#/simulator` y
por el botón "Try a prompt" de Rules — no queda huérfano.

## 1. Lo que ya existe y no se toca

- **Cero cambios de servidor.** Todos los endpoints se consumen tal cual:
  `/api/settings/models*` (`docs/MODEL-MANAGEMENT.md`, tabla HTTP),
  `/api/settings/compiler`, `/api/settings/adjudicator`, `/api/prompts`.
- **La lógica cliente de cada feature se reusa.** `web/js/model-library.js`
  (catálogo, editor, transfers con polling), `web/js/compiler.js`
  (draft/test/apply del compiler y el setup guiado de Claude Code),
  `web/js/prompt-editor.js` (drafts por template, conflicto de revisión).
  Cambia el markup que emiten y desde dónde se los llama, no sus flujos ni
  requests.
- **El router no cambia** (`web/js/router.js`): `#/view/sel?query` ya da
  todo lo que las tabs necesitan — Team lo prueba (`web/js/team.js:31-32`).
- `web/js/engine.js` (Runtime details) queda como página aparte con
  `railParent: 'models'`, enlazada desde la tab Active como hoy
  (`web/js/models.js:90`).
- `web/js/rules.js`, `web/js/simulator.js`, `web/js/documents.js` — de
  esos se ocupa rules-redesign; acá no se tocan (salvo el borrado de la
  sección en `models.js` que apunta al simulator, §3).

## 2. Routing: las tabs son `sel`, la vista sigue siendo `models`

Mismo patrón que Team (`TABS` + `tabOf()`, `web/js/team.js:31-32`):

| Hash | Tab |
| --- | --- |
| `#/models` | Active |
| `#/models/library` | Library |
| `#/models/prompts` | Prompts |

`VIEWS.models.body` elige por `tabOf()`; cualquier otro `sel` cae a Active
(Models no tiene páginas por-item como sí tiene Team con las personas).
Las tabs se marcan con el markup de Team: `<nav class="tabs">` + botones
`.tab` con `data-go="models"` / `data-sel` (`web/js/team.js:65-67`).

**Por qué esto no rompe nada de estado:** `state.view` sigue siendo
`'models'` en las tres tabs, así que `activePage()`
(`web/js/model-library.js:12`) y `repaint()` (`web/js/prompt-editor.js:12`)
— los guardas que evitan pisar renders y dejan morir el polling de
transfers al salir — funcionan sin cambios. El polling de transfers corre
aunque el admin esté mirando otra tab de Models: correcto, porque al volver
a Library el progreso está fresco.

Compatibilidad de deep links, explícita:

- `#/compiler` — el alias `VIEWS.compiler` (`web/js/models.js:121`) queda,
  ahora rendereando la tab Active con el editor del compiler expandido
  (hoy ya lo hace vía `enterModels`, `web/js/models.js:22-24`).
- `#/models?setup=compiler` (lo emite `compilerSetupNudge`,
  `web/js/compiler.js:21`) — aterriza en Active con el compiler expandido;
  la condición `state.query?.setup === 'compiler'` ya existe
  (`web/js/models.js:23`).
- `data-go="engine"` — sin cambios.
- La nav superior no cambia de items (`web/js/nav.js:36` ya dice Models).

## 3. Tab Active (frames 97:338 primer arranque, 99:451 configurado)

`activeRole()` (`web/js/models.js:44-66`) se reescribe al shape de tarjeta
del frame: **título + una línea + chip de estado + acciones**, en una
tarjeta por rol con los nombres del frame — **Rule writer** (compiler,
"Turns your instructions into rules") y **Request judge** (analyzer,
"Checks employee requests and documents"). Se conserva entero el
comportamiento actual:

- El acordeón `expanded` (variable de módulo, `web/js/models.js:12`): un
  editor abierto a la vez; `Change model` abre `compilerSettings()` /
  `analyzerSettings()` inline debajo de la tarjeta; `Edit prompts` deja de
  abrir el editor inline — ahora navega a la tab Prompts (§5) con el
  template del rol preseleccionado (`promptEditor.selected[role]` ya
  existe, `web/js/prompt-editor.js:5`).
- `runtimeNote()` (`web/js/models.js:36-42`) se comprime a la línea de
  estado del header de página + link "Runtime details"; los casos de error
  (`bad`) conservan su `role="status"`.
- Primer arranque (`compilerNeedsSetup()`, `web/js/compiler.js:14-16`): la
  tarjeta Rule writer carga los pasos guiados (install / sign in / test /
  apply) con **los pasos completados colapsados a una línea con check** —
  el frame 97:338 fija el layout. La detección y los requests son los de
  `compilerSettings()` hoy; cambia solo la presentación por pasos.
- El copy del nudge global (`web/js/compiler.js:21`) cambia de "Configure
  Claude Code" a nombrar el trabajo: título "Choose what writes your
  rules", acción "Set up the rule writer" (destino igual:
  `data-go="models" data-q="setup=compiler"`). Es el fix directo del
  hallazgo del PRD §0.
- La nota de analyzer de tres oraciones (`web/js/models.js:75`) se reduce a
  la que carga peso de seguridad: "The analyzer always runs on this
  gateway." — el resto ya lo dicen las filas de opciones.

Qué muere en esta tab: la sección "Documents use the same analyzer" con el
botón "Try a document" (`web/js/models.js:93`) — el tester pasa a vivir en
Rules (rules-redesign; ver la nota de coordinación arriba). La frase de que
los documentos usan el mismo analyzer pasa a letra chica de la tarjeta
Request judge (una línea, no una sección).

## 4. Tab Library (frame 102:335)

`libraryMarkup()` (`web/js/model-library.js:123-132`) pasa a ser el cuerpo
completo de la tab:

- Header de sección: línea única "Saved weights and connections, shared by
  this installation." + botón primario **Add model** (absorbe la nota
  duplicada de `model-library.js:125` — hoy "shared" se dice dos veces).
- `modelRow()` (`model-library.js:82-103`) se reescribe a fila de tabla
  MODEL / ROLES / FORMAT / STATUS (mismo shape que las tablas de Team,
  `.tbl/.thead/.trow`): MODEL es el nombre + detalle mono (filename+tamaño
  o `model · baseUrl`), ROLES los roles con su estado de test, FORMAT
  `compliance`/`dynaguard`/`endpoint`, STATUS el chip
  (`Active analyzer` / `Needs test` / `Downloaded · tested`). Las acciones
  por fila (Test / Use / Edit / Remove) van al patrón menú `···` de Team
  (`web/js/team.js:191-198`) salvo la primaria contextual (Use cuando está
  testeado). Los hooks `data-model-*` y `bindLibrary()` quedan; solo cambia
  el contenedor.
- El editor de alta/edición (`editorMarkup()`), los transfers
  (`transferMarkup()`) y el confirm de borrado quedan funcionalmente igual,
  dentro de la tab.
- Los built-ins del analyzer **no** se duplican acá: siguen siendo opciones
  del editor del Request judge en Active (`analyzerSettings()`), como hoy.
  La tabla lista el catálogo custom (`/api/settings/models`); el frame
  muestra built-ins en filas por claridad visual, pero implementarlo así
  exigiría mezclar dos APIs con semánticas de activación distintas — se
  implementa catálogo-solo y se revisa contra el frame al final.

## 5. Tab Prompts (frame 102:458)

Hoy el editor de prompts se abre inline bajo cada rol
(`promptEditorMarkup(role)`, `web/js/models.js:64`). Pasa a:

- Una tabla TEMPLATE / JOB / STATUS: una fila por template del catálogo
  (`promptEditor.catalog.templates`), JOB = compiler/analyzer
  (`roleLabel`), STATUS = `Default` o `Customized` (el catálogo ya expone
  qué template difiere del default) + `Unsaved changes` cuando
  `dirty(draft)` (`web/js/prompt-editor.js:11`).
- **Edit** por fila abre el editor existente (textarea, variables
  requeridas, guardar/restaurar, conflicto de revisión) para ese template.
  Toda la máquina de drafts (`promptEditor.drafts`, `acceptPromptCatalog`,
  el guard de `beforeunload`) se reusa sin cambios.
- `hasPromptChanges()` (`prompt-editor.js:25-27`) marca la tab con un punto
  para que un draft sin guardar no quede invisible desde otra tab.

## 6. CSS (`web/style.css`)

- Solo tokens existentes (la colección de variables de Figma los espeja);
  ningún hex nuevo, ningún valor de espaciado fuera de la escala.
- **Pieza compartida con rules-redesign:** el estado `.nav-item.on` del
  topnav pasa de fondo pill a subrayado — texto + borde inferior 2px
  `ink`, sin fill, sin radius. Si rules-redesign ya lo hizo, no tocar.
- Las sub-tabs ya tienen el estilo correcto (`.tabs/.tab` de Team); Models
  lo reusa tal cual.
- Clases nuevas mínimas: la tarjeta de rol de Active (grid de dos) y las
  celdas de las dos tablas nuevas si `.tbl` no alcanza con sus columnas.
  Todo lo que pueda ser `.tbl`, `.trow`, `.chip`, `.badge`, `.note`
  existentes, lo es.
- Muere el CSS huérfano de lo que se va: `.models-document-note`,
  `.models-runtime-line` (grep antes de borrar).

## 7. Copy: destino de cada string con peso

| Hoy | Pasa a |
| --- | --- |
| "Configure Claude Code" (nudge, `compiler.js:21`) | "Choose what writes your rules" / botón "Set up the rule writer" |
| "Choose what writes your rules and what checks each request. Edit the prompts each role uses." (`models.js:89`) | Solo la primera oración, línea de estado del header |
| Nota analyzer de 3 oraciones (`models.js:75`) | "The analyzer always runs on this gateway." |
| "These settings are shared by administrators of this Warden installation." (`model-library.js:125`) | Fundida en la línea del header de Library ("shared by this installation") |
| "Documents use the same analyzer" + sección (`models.js:93`) | Una línea de letra chica en la tarjeta Request judge |

Invariante de copy: ninguna salvedad de seguridad desaparece — "analysis
always runs locally", "keys are never returned to this page", "compatibility
is not policy accuracy" se mudan, no se borran.

## 8. Qué no cambia

- `src/` entero; ningún endpoint, ningún contrato, ningún default medido.
- `web/js/rules.js`, `web/js/simulator.js`, `web/js/draft.js`,
  `web/js/documents.js` (territorio de rules-redesign),
  `web/js/engine.js` (salvo el link de vuelta si su copy nombra tabs).
- El orden de middleware, la autorización admin, la identidad.
- El comportamiento de foco tras cada render (los `?.focus()` repartidos
  por `models.js`/`model-library.js`) se conserva por acción equivalente.

## 9. Verificación

- `pnpm run typecheck`, `pnpm test`, `pnpm run build` — sin regresiones.
- Manual en navegador, desktop y ancho angosto (requisito ya vigente de
  `docs/specs/documents-and-model-management.md`: "Browser interaction
  checks at desktop and narrow widths"), cubriendo: primer arranque con
  compiler sin configurar (mock), cambio de analyzer, alta/test/activación
  de modelo custom, un transfer con progreso y cancelación, edición de
  prompt con draft sin guardar cruzando de tab, y los deep links de §2.
- Screenshot de cada tab contra su frame de Figma (97:338, 99:451,
  102:335, 102:458) antes de dar por cerrado.
- Grep final: cero clases CSS huérfanas, cero apariciones de "Configure
  Claude Code" en `web/`, y el tester sigue alcanzable en `#/simulator`
  (su rediseño es de rules-redesign, pero este cambio no puede dejarlo
  inalcanzable si se mergea primero).

## 10. Fuera de este documento

El rediseño de Rules — las tres tabs New rule | Rules | Test, la tabla con
filtros y el nuevo hogar del tester — es `docs/specs/rules-redesign.md`.
