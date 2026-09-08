# Rediseño de la consola: Rules en tres tabs — Spec técnico

Sigue a `docs/prd/rules-redesign.md`. Acá se cierra el cómo: rutas, qué
módulo cambia y qué se reusa tal cual, el destino del copy actual, y qué
verificar. Las decisiones de producto del PRD (§4) son insumo fijo.

Todas las referencias `archivo:línea` son al estado del repo al 2026-09-08
(main en `a739225`). Los frames de Figma citados viven en el archivo
"Warden" (`RFPKLtSSZjQMHy9XaOOSqp`), página Console, sección Rules:
"Rules / New rule" (74:335), "Rules / Rules" (112:369), "Rules / Test"
(104:347).

**Coordinación con `docs/specs/models-redesign.md`** (implementable en
cualquier orden, por agentes distintos): dos piezas son compartidas — (a)
el CSS del estado activo del topnav (subrayado, §7 acá: misma definición
en ambos specs; el que llegue primero lo implementa, el segundo verifica
que ya esté y no lo duplica) y (b) el botón "Try a document" al pie de
Models (`web/js/models.js:93`): **borrarlo es alcance de models-redesign**,
no de este spec — si al implementar este spec ese botón todavía existe, se
deja; sigue apuntando a `#/simulator`, que acá se convierte en la tab Test,
así que no rompe nada.

## 1. Lo que ya existe y no se toca

- **Cero cambios de servidor.** `/api/policy/*` (draft, ratify, delete),
  `/api/company/sample/clear`, `/api/guard/check` y los endpoints de
  documentos se consumen tal cual.
- **La conversación de New rule por dentro**: `web/js/draft.js` (el hilo,
  `ruleChatPane`, `sendRuleMessage`), `web/js/draft-set.js`,
  `web/js/answers.js`. Cambia solo el marco que la envuelve (§3).
- **El motor del tester**: `web/js/simulator.js` (envío, `renderMessage`,
  follow-ups, appeals) y `web/js/documents.js` entero (adjuntos,
  capacidades, polling de extracción). Cambia solo su encabezado (§5).
- **El router** (`web/js/router.js`) y el mecanismo de navegación
  delegada (`data-go`/`data-sel`/`data-toggle`, `web/js/nav.js:104-119`).
- `composing()` (`web/js/rules.js:26-28`) y el guard de Escape
  (`web/js/nav.js:121-123`): New rule sigue siendo `view=policy,
  sel=new`, así que ninguno cambia.
- La nav superior: el item Rules conserva `sel: 'new'`
  (`web/js/nav.js:30`) — con New rule como primera tab, el comentario de
  `nav.js:24-25` sigue siendo verdad tal cual está escrito.

## 2. Routing: tres tabs sobre dos vistas existentes

No se agregan vistas nuevas; se re-encabezan las dos que existen:

| Hash | Tab activa | Body |
| --- | --- | --- |
| `#/policy/new` | New rule | `newRulePage()` / `ruleChatPane()` (hoy igual) |
| `#/policy` | Rules | la tabla nueva (§4) |
| `#/policy/<ruleId>` | Rules | la tabla con esa regla expandida (hoy igual: `state.sel` = id) |
| `#/simulator` | Test | el simulator re-encabezado (§5) |

La tab Test es un `data-go="simulator"` — cruza de vista, y
`railParent: 'policy'` (`web/js/simulator.js:20`) ya hace que la nav
superior siga marcando Rules. Todos los `data-go="simulator"` existentes
en otras vistas siguen funcionando sin tocarse.

`sel` en policy conserva sus dos significados de hoy ('new' o un id de
regla) — las tabs no le agregan un tercero, así que el riesgo del PRD §6
se resuelve por construcción: un `#/policy/<ruleId>` linkeado desde
Activity o desde la página de una persona abre la lista con esa regla
expandida, como hoy.

## 3. El marco compartido: header + tabs en las tres

- `rulesTabs()` (`web/js/rules.js:39-49`) se reescribe: muere el
  `<span class="seg">` (segmented pill) y sale el markup de tabs de Team
  (`<nav class="tabs">` + `.tab`, `web/js/team.js:65-67`):
  `[New rule | Rules | Test]` → `data-go="policy" data-sel="new"` /
  `data-go="policy"` / `data-go="simulator"`. El punto de draft pendiente
  (`rules.js:43`: `state.draft || state.set`) queda en la tab New rule.
- Header de página compartido, patrón `pageHead()` de Team
  (`web/js/team.js:94-110`): título "Rules" + línea de estado
  "N active · M checks today · test anything →". `N active` =
  `state.policy.rules.length`; "M checks today" se computa de
  `state.audit` (ya cargado por la consola) filtrando al día corriente;
  "test anything →" es un `linkbtn` a `data-go="simulator"`, omitido en la
  propia tab Test. Un helper exportado desde `rules.js` que el simulator
  importa — una sola definición.
- El botón "Try a prompt" de la toolbar de la lista (`rules.js:55`) muere:
  la tab Test lo reemplaza.

## 4. Tab Rules: la tabla (frame 112:369)

`rulesBody()` (`web/js/rules.js:52-72`) se reescribe:

- **Fila de filtros** entre tabs y tabla: conteos por severidad
  ("All N · Block N · Escalate N · Warn N" — el activo en ink Medium, el
  resto muted; computados de `state.policy.rules`) y un input de búsqueda
  por texto a la derecha. Filtran en cliente (estado local del módulo,
  como `expanded` en models.js), sin request y sin tocar el hash.
- **La tabla** (`.tbl/.thead/.trow`, mismo shape que Team
  `web/js/team.js:159-162`): columnas RULE / APPLIES TO / IF IT FIRES /
  ACTIVITY.
  - RULE: `ruleName(r)` en Medium (el texto completo ya no va en la fila —
    vive en el detalle).
  - APPLIES TO: `audienceLabel(r.appliesTo)` (`web/js/format.js`).
  - IF IT FIRES: chip de severidad con los colores de veredicto ya
    presentes en `style.css` (`.badge`); Warn usa neutro (sunken + muted).
  - ACTIVITY: la frase que hoy arma `ruleDetail`
    (`rules.js:275-283`: hits sobre `state.audit`, bloqueados, disputas de
    `state.appeals`) **extraída a un helper** que la fila y el detalle
    comparten — se eleva, no se duplica (riesgo del PRD §6). Formas:
    "Stopped X of Y", "X of Y · N disputed", "Has not fired yet".
  - La fila conserva `data-toggle="policy" data-sel="<id>"` y
    `aria-expanded`: click expande `ruleDetail(r)` debajo, que no cambia
    por dentro (kv, evidencia, examples, Remove rule).
- **Qué se va de esta tab:**
  - "Take out what came with Warden" (`rules.js:61-64`) deja de ser botón
    permanente: se muestra solo dentro de un banner de sample data cuando
    `state.company.demo` (mismo criterio y copy que el `demoBanner` de
    Team, `web/js/team.js:118-122`), con la misma lógica de `bindSweeps`
    (`rules.js:113-129`) — incluida la respuesta "Nothing here came with
    Warden…" si no matchea nada, que con el banner condicionado no debería
    ser alcanzable, pero queda como defensa.
  - "Limits by role" (`rules.js:66-70`) se va de Rules por completo: ya
    vive en Team → Roles (`web/js/team.js:263`, columna "Daily limit").
    `limitsGrid()` (`web/js/limits.js`) queda para esa vista; si Rules era
    su único consumidor, el import se limpia de `rules.js`.
- **Al pie**: "Delete every rule" como único link destructivo — hairline
  arriba, color `verdict/block` apagado (la clase `danger` existente),
  misma lógica y confirm de `bindSweeps` (`rules.js:131-139`). Sin caja
  "danger zone" (PRD §4).
- El empty state (`rules.js:58-59`, "No rules yet, so nothing gets
  stopped") se conserva: reemplaza a la tabla cuando no hay reglas, con
  los filtros ocultos.

## 5. Tab Test: el simulator re-encabezado (frame 104:347)

`VIEWS.simulator` (`web/js/simulator.js:19-57`) cambia solo su cáscara:

- El botón `backToRules` ("← Rules", `simulator.js:17`) muere; en su lugar,
  el header de página + tabs del §3 con Test activa. El export
  `backToRules` se elimina y se barren sus usos (grep).
- El selector "Send as" (`simulator.js:29-32`) se conserva, alineado a la
  derecha bajo el header (el frame muestra el hilo sin selector porque
  retrata una instalación solo; el selector queda — es la identidad del
  test y las reglas por rol dependen de él).
- Todo lo demás queda: `state.chat`, `doSend`, `renderMessage` (veredicto,
  WHY, chips de documentos, "How it was decided"), los follow-ups, el
  composer con adjuntos (`documentComposer()`), los empty states. El
  placeholder del composer adopta el del frame: "Drop a file, or paste a
  request to test…", y el botón "Check request" → "Test".

## 6. Copy: destino de cada string con peso

| Hoy | Pasa a |
| --- | --- |
| "New rule" / "Rules" en el seg (`rules.js:43-44`) | Tabs "New rule" / "Rules" (mismo texto, otro componente) |
| "Try a prompt" (`rules.js:55`) | La tab "Test" |
| "Take out what came with Warden" (`rules.js:62`) | Dentro del banner de sample data, solo cuando `state.company.demo` |
| "Delete every rule" (`rules.js:63`) | Link al pie, clase danger, mismo confirm |
| "Limits by role" + nota de tokens (`rules.js:67-69`) | Se va de Rules; vive solo en Team → Roles |
| "← Rules" (`simulator.js:17`) | Muere; lo reemplazan header + tabs |
| "Write a prompt, or attach a document…" (`simulator.js:43`) | "Drop a file, or paste a request to test…" |
| "Check request" (`simulator.js:44`) | "Test" |

Invariante de copy: el confirm de "Delete every rule" conserva su frase
completa ("Warden will stop nothing until you write another…" —
`rules.js:134`); la advertencia de identidad exenta en "Send as"
(`sendAsOptions`, `rules.js:94-101`) no se toca.

## 7. CSS (`web/style.css`)

- Solo tokens existentes; ningún hex nuevo.
- **Pieza compartida con models-redesign:** el estado `.nav-item.on` del
  topnav pasa de fondo pill a subrayado — texto + borde inferior 2px
  `ink`, sin fill, sin radius. Si models-redesign ya lo hizo, no tocar.
- Las tabs reusan `.tabs/.tab` de Team tal cual.
- Nuevo, mínimo: la fila de filtros (conteos + input de búsqueda) y las
  columnas de la tabla de reglas si `.tbl` no alcanza. El `.seg` muere si
  Rules era su único consumidor (grep antes de borrar).

## 8. Qué no cambia

- `src/` entero; ningún endpoint, ningún contrato.
- `web/js/draft.js`, `web/js/draft-set.js`, `web/js/answers.js`,
  `web/js/documents.js`, `web/js/limits.js` (solo pierde un consumidor),
  `web/js/nav.js` (ni items ni `sel`), `web/js/router.js`.
- La vista Models (`web/js/models.js`, `model-library.js`,
  `prompt-editor.js`, `compiler.js`, `engine.js`) — territorio de
  models-redesign.
- Los banners globales (`firstRunBanner`, `mockBanner`,
  `rules.js:197-231`) y dónde se insertan.

## 9. Verificación

- `pnpm run typecheck`, `pnpm test`, `pnpm run build` — sin regresiones.
- Manual en navegador, desktop y ancho angosto, cubriendo: escribir una
  regla y activarla (el hilo completo), el punto de draft pendiente
  visible desde las otras dos tabs, expandir/colapsar una regla por click
  y por `#/policy/<ruleId>` directo, filtrar por severidad y por texto,
  borrar una regla, "Delete every rule" con su confirm, el banner de
  sample data con su acción (arrancando con el sample cargado) y su
  ausencia sin demo, y en Test: un prompt bloqueado, un documento
  adjuntado con su reporte de extracción, y el cambio de "Send as".
- Screenshot de cada tab contra su frame de Figma (74:335, 112:369,
  104:347) antes de dar por cerrado.
- Grep final: cero usos de `backToRules`, cero `.seg` huérfano, "Limits by
  role" solo en Team, y todos los `data-go="simulator"` del repo llegando
  a la tab Test.

## 10. Fuera de este documento

La vista Models es `docs/specs/models-redesign.md`. El detalle expandido
de una regla (`ruleDetail`) conserva su diseño actual; si se decide
rediseñarlo, es una iteración posterior con su propio frame.
