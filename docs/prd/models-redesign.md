# Rediseño de la consola: Models en tabs — PRD

Cubre el rediseño de la vista `/models` de la consola. Es enteramente
superficie de producto: cero cambios de endpoints, cero cambios en el
guard. El diseño ya está cerrado en Figma (archivo "Warden", página
Console — ver §4); este documento fija el porqué y las decisiones, y
`docs/specs/models-redesign.md` fija el cómo.

Hermano de esta serie: el rediseño de la vista Rules es un par de
documentos aparte (`docs/prd/rules-redesign.md` +
`docs/specs/rules-redesign.md`), pensado para implementarse por separado.
Comparten dos piezas de sistema (el componente de tabs subrayadas y el
estado activo del topnav); la coordinación exacta está en los specs.

## 0. Por qué existe este documento

La vista `/models` actual acumula cuatro features apiladas en una página:
los dos roles de modelo con sus editores inline, la librería de modelos
custom, el editor de prompts, y un tester de documentos al pie. El problema
se diagnosticó en vivo el 2026-09-08 con un usuario nuevo (el propio owner
haciendo de usuario nuevo) y los síntomas fueron concretos:

- **"Configure Claude Code" se lee como cablear el Claude Code vigilado**,
  no como elegir el modelo que escribe reglas. El usuario nuevo no entendió
  para qué quería "conectar Claude" — si era para el hook, para configurar
  Warden, o para otra cosa. Es la confusión más cara de la página porque
  aparece primero (`compilerSetupNudge`, `web/js/compiler.js:21`).
- **Prosa de documentación como copy de UI.** Frases de tres renglones con
  salvedades ("Choose installed weights, or select a model to download. The
  analyzer always runs on this gateway. Your own compatible models appear
  in Your models below.") donde una línea alcanzaba.
- **Tres niveles de paneles grises anidados** (sheet → section → editor),
  sin jerarquía tipográfica: casi todo 13px regular, nada gana.
- **Ningún botón primario por sección.** La página no dice qué hacer.
- **Un tester de documentos al final de Models** que no configura nada: se
  usa para probar el guard, que es trabajo de Rules, no de Models. (Su
  nuevo hogar es la tab Test de Rules — eso es alcance del par
  rules-redesign; lo que es alcance de acá es que de Models se va.)
- **Pasos de wizard que nunca colapsan** en el primer arranque: el setup
  guiado del compiler queda desplegado entero aunque ya esté hecho.

## 1. Usuario y trabajo a resolver

El administrador de una instalación, en dos momentos distintos:

- **Primer arranque:** "¿qué escribe mis reglas y qué juzga los requests?
  Configurámelo con la menor fricción posible." Hoy ese momento abre con la
  frase que más confunde.
- **Sesión 100:** "¿qué modelo está activo en cada rol ahora, y cómo lo
  cambio / lo pruebo / le edito el prompt?" Hoy responde eso una página que
  muestra todo a la vez.

## 2. Qué no es (alcance)

- No cambia ningún endpoint ni contrato HTTP. `/api/settings/models`,
  `/api/settings/compiler`, `/api/settings/adjudicator`, `/api/prompts` se
  consumen tal cual (`docs/MODEL-MANAGEMENT.md` sigue siendo el contrato).
- No cambia la lógica de librería, transfers, tests de compatibilidad,
  activación ni el editor de prompts — solo dónde y cómo se muestran.
- No toca la vista Rules ni el simulator — eso es el par rules-redesign.
- No toca `src/` en absoluto.

## 3. Experiencia deseada

**Models son tres tabs, no una página.** Sub-tabs con el mismo componente
subrayado que ya usa Team, en orden de frecuencia de uso:

1. **Active** — el estado vivo. Dos tarjetas de trabajo: **Rule writer**
   (compiler: "Turns your instructions into rules") y **Request judge**
   (analyzer: "Checks employee requests and documents"). Cada tarjeta es
   exactamente título + una línea + un chip de estado + una acción; los
   editores de cambio de modelo se abren inline debajo, de a uno. En primer
   arranque la tarjeta Rule writer carga el setup guiado de Claude Code, con
   los pasos completados colapsados — y el copy dice lo que es ("elegí qué
   escribe tus reglas"), nunca "Configure Claude Code" a secas.
2. **Library** — el inventario: una tabla MODEL / ROLES / FORMAT / STATUS
   con pesos locales (.gguf) **y** conexiones endpoint en las mismas filas,
   y un solo botón primario, **Add model**, que abre el editor existente.
3. **Prompts** — lo que menos se toca: una tabla TEMPLATE / JOB / STATUS
   con Edit por fila, que abre el editor de templates existente.

La sección "Documents use the same analyzer" con su botón "Try a document"
desaparece de Models; la frase con peso de seguridad (los documentos usan
el mismo analyzer local) pasa a letra chica de la tarjeta Request judge.

## 4. Decisiones de producto

- **Nombres de tabs: Active | Library | Prompts.** La primera se llamó
  "Jobs" (los dos trabajos del modelo) y se descartó el 2026-09-08 por
  jerga: en una página de Models suena a tareas en background. "Active"
  responde la pregunta real de la tab. El orden es frecuencia de uso:
  estado → inventario → templates.
- **Estados seleccionados subrayados, nunca pill.** Vale para el topnav y
  para las sub-tabs. Es regla de sistema desde el 2026-09-08, ya aplicada
  en todos los frames de Figma.
- **Regla editorial por tarjeta/sección:** un título, una línea de copy, un
  estado, una acción. Las salvedades y letra chica que hoy son párrafos van
  a tooltips o notas al pie, no al cuerpo.
- **Las creaciones se abren desde un botón:** Add model abre el editor
  existente; no hay tab de creación en Models.
- **Figma es la fuente de verdad del layout y el copy.** Archivo "Warden"
  (fileKey `RFPKLtSSZjQMHy9XaOOSqp`), página Console, sección Models:
  "Models / Active — first run" (97:338), "Models / Active" (99:451),
  "Models / Library" (102:335), "Models / Prompts" (102:458). Los frames
  están construidos contra la colección de variables "Warden", que espeja
  los tokens de `web/style.css` — la implementación usa esos tokens,
  ningún hex nuevo.

## 5. Métricas de éxito

- Un usuario nuevo en primer arranque puede decir qué configura la página
  sin leer un doc — y "Configure Claude Code" ya no es la primera frase.
- Cada tab responde una sola pregunta; el squint test da una jerarquía
  clara (título > tarjeta > nota) en las tres.
- Cero regresiones de comportamiento: todos los flujos existentes (cambiar
  analyzer, guardar compiler, test/activar/editar/borrar modelo custom,
  transfers con progreso, editar prompts con conflicto de revisión) siguen
  funcionando igual.
- Los deep links existentes siguen resolviendo (`#/compiler`,
  `#/models?setup=compiler`, `data-go="engine"`).

## 6. Riesgos

- La vista actual reparte estado entre módulos que chequean en qué vista
  están (`activePage()` en `web/js/model-library.js:12`, `repaint()` en
  `web/js/prompt-editor.js:12`) para no pisar renders ni dejar polls vivos.
  El spec fija cómo las tabs conviven con eso sin romper el polling de
  transfers ni el foco.
- El copy nuevo es más corto porque promete menos por frase; hay que cuidar
  que ninguna salvedad con peso de seguridad (p. ej. "analysis always runs
  locally") desaparezca en vez de mudarse a letra chica.

## 7. Fuera de este documento

Rutas y `sel` exactos, qué función se parte en qué módulo, el destino de
cada string actual, y la verificación — eso es
`docs/specs/models-redesign.md`. El rediseño de Rules (incluido el nuevo
hogar del tester) es `docs/prd/rules-redesign.md`.
