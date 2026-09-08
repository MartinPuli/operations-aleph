# Rediseño de la consola: Rules en tres tabs — PRD

Cubre el rediseño de la vista Rules de la consola: la lista, la
conversación de New rule y el nuevo hogar del tester de prompts y
documentos. Es enteramente superficie de producto: cero cambios de
endpoints, cero cambios en el guard. El diseño ya está cerrado en Figma
(ver §4); `docs/specs/rules-redesign.md` fija el cómo.

Hermano de esta serie: `docs/prd/models-redesign.md` +
`docs/specs/models-redesign.md` (la vista Models). Se implementan por
separado, en cualquier orden; las piezas compartidas y su coordinación
están declaradas en ambos specs.

## 0. Por qué existe este documento

La vista Rules hoy (`web/js/rules.js`) tiene los mismos vicios que se
diagnosticaron en Models el 2026-09-08, más algunos propios:

- **El switch New rule / Rules es un segmented pill** (`rulesTabs`,
  `rules.js:39-49`), distinto del componente de tabs subrayadas que Team ya
  estableció como patrón de la consola.
- **La lista de reglas son filas apiladas de tres líneas** (nombre + texto
  completo + badges, `ruleRow`, `rules.js:257-273`): mucha tinta por fila,
  jerarquía plana, difícil de barrer.
- **"Take out what came with Warden" es un botón permanente**
  (`rules.js:61-64`) para una acción de una sola vez — limpiar el demo —
  que además borra personas, no solo reglas. El 99% del tiempo es un no-op
  con aspecto de feature.
- **"Limits by role" está duplicado**: la misma información (cuota diaria
  por rol) ya vive en Team → Roles (`web/js/team.js:263`), que es donde se
  administran los roles. Dos vistas mostrando lo mismo es el apilamiento
  que este rediseño cura.
- **El tester no tiene un hogar coherente**: el simulator (`#/simulator`)
  se alcanza por un botón "Try a prompt" en Rules y por un "Try a document"
  al pie de Models. Probar la política es trabajo de Rules; merece ser una
  tab, no dos botones repartidos.
- **"Delete every rule" leía como un link neutro** cualquiera, siendo la
  acción más destructiva de la vista.

## 1. Usuario y trabajo a resolver

El administrador, en tres modos de uso distintos que hoy comparten una
página y media:

- **Escribir una regla** — una conversación con Warden (el modo que ya
  funciona bien y no se toca por dentro).
- **Barrer la política** — "¿qué reglas tengo, a quién aplican, qué
  hicieron?" — hoy responde eso una lista que hay que leer entera.
- **Probar la política** — "¿este request / este archivo pasaría?" — hoy
  vive detrás de dos botones en dos vistas distintas.

## 2. Qué no es (alcance)

- No cambia ningún endpoint ni contrato HTTP (`/api/policy/*`,
  `/api/guard/check`, `/api/company/sample/clear` se consumen tal cual).
- No toca la conversación de New rule por dentro (`web/js/draft.js`,
  `web/js/draft-set.js`, `web/js/answers.js`) ni el pipeline de documentos
  (`web/js/documents.js`). El tester se muda y se re-encabeza, no se
  reescribe.
- No toca la vista Models — eso es el par models-redesign.
- No toca `src/` en absoluto.

## 3. Experiencia deseada

**Rules son tres tabs** — el mismo componente subrayado de Team, y las tres
comparten el mismo header de página (título "Rules" + línea de estado
"N active · M checks today · test anything →"):

1. **New rule** — la conversación de redacción, exactamente como es hoy
   (hero composer → hilo con la rule card, chips de severidad/audiencia,
   Activate/Discard). Solo cambia el marco: header + tabs en lugar del
   segmented pill. La nav sigue aterrizando acá.
2. **Rules** — la lista, rediseñada como tabla:
   RULE / APPLIES TO / IF IT FIRES / ACTIVITY. El nombre en Medium, la
   severidad como chip en color de veredicto (Block rojo, Escalate ámbar,
   Warn neutro), la actividad como frase ("Stopped 9 of 31",
   "1 of 4 · 1 disputed"). Arriba de la tabla, **filtros**: conteos por
   severidad ("All N · Block N · Escalate N · Warn N") y búsqueda por
   texto. Click en una fila expande el detalle actual debajo. Al pie, un
   único link destructivo: "Delete every rule", en rojo apagado, separado
   por un hairline.
3. **Test** — el simulator actual como tab: mandás un prompt o soltás un
   archivo como alguien del equipo y ves el veredicto con su evidencia
   (el hilo YOU → WARDEN con la tarjeta de bloqueo, chips de extracción,
   el WHY, y el composer "Drop a file, or paste a request to test…").

## 4. Decisiones de producto

- **New rule sigue siendo tab** (decisión del owner, 2026-09-08). Es una
  creación, y la regla general de la consola es "creaciones desde un
  botón" — pero es la acción diaria primaria de esta vista y la nav ya
  aterriza ahí; se gana la tab como excepción declarada.
- **"Take out what came with Warden" deja de ser un botón permanente.** Se
  muestra únicamente dentro del banner de sample data, mientras haya
  contenido de muestra que sacar — aparece cuando aplica, desaparece
  después (mismo criterio que el banner de Team).
- **"Limits by role" se va de Rules.** Vive solo en Team → Roles, donde ya
  estaba y donde se administran los roles. Una cosa, un lugar.
- **Filtros en lugar de secciones.** La tabla se filtra en cliente por
  severidad y por texto; no se agregan secciones apiladas debajo.
- **Destructivo se ve destructivo, sin danger zone.** "Delete every rule"
  va en rojo de veredicto apagado con hairline arriba. La caja "danger
  zone" estilo GitHub queda descartada para esta vista: es un patrón para
  páginas de settings con varias acciones destructivas juntas; acá hay una
  sola y el confirm existente es la segunda barrera. Si Rules acumula más
  acciones destructivas, se gradúa a sección.
- **Estados seleccionados subrayados, nunca pill** (regla de sistema del
  2026-09-08). El segmented pill actual muere.
- **Figma es la fuente de verdad del layout y el copy.** Archivo "Warden"
  (fileKey `RFPKLtSSZjQMHy9XaOOSqp`), página Console, sección Rules:
  "Rules / New rule" (74:335), "Rules / Rules" (112:369), "Rules / Test"
  (104:347). Construidos contra la colección de variables "Warden", que
  espeja los tokens de `web/style.css` — la implementación usa esos
  tokens, ningún hex nuevo.

## 5. Métricas de éxito

- Las tres preguntas del §1 tienen cada una su tab, y saltar de tab no
  mueve el header.
- La lista pasa el squint test: una regla por línea, severidad y actividad
  legibles sin leer el texto completo de cada regla.
- Probar la política es un destino visible (la tab Test), no dos botones
  repartidos en dos vistas.
- Cero regresiones: escribir/activar/descartar una regla, expandir su
  detalle, borrar una, limpiar el sample, borrar todo, probar un prompt y
  un documento — todo sigue funcionando igual.
- Los links existentes siguen resolviendo (`data-go="simulator"` desde
  cualquier vista, `#/policy/new`, `#/policy/<ruleId>`).

## 6. Riesgos

- `sel` en la vista policy hoy significa "id de regla o 'new'"; las tabs
  agregan significados. El spec fija el mapeo para que un id de regla siga
  abriendo la lista con esa regla expandida.
- El simulator comparte `state.chat` y el flujo de documentos con otras
  superficies; re-encabezarlo no puede tocar su lógica de envío ni el
  polling de extracción.
- La fila de la tabla resume datos (actividad, disputas) que hoy se
  computan recién en el detalle; elevarlos a la fila no debe duplicar la
  lógica — se extrae, no se copia.

## 7. Fuera de este documento

Rutas y `sel` exactos, el mapeo de cada función actual a su tab, el
destino de cada string, y la verificación — eso es
`docs/specs/rules-redesign.md`.
