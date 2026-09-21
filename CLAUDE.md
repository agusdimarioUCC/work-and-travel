# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Nota Institucional - Work and Travel (UCC)

Google Apps Script. Genera la constancia de alumno regular que piden los
alumnos de la Facultad de Ingeniería de la Universidad Católica de Córdoba
para trámites de Work and Travel.

**Flujo completo:** el alumno sube el PDF de su Ficha del Alumno en una web
app → se extraen sus datos del PDF → se cruzan contra dos hojas de referencia
→ sale la constancia en PDF → Aaron la firma.

**Volumen:** menos de 100 constancias por temporada. Cualquier propuesta de
colas de trabajo, reintentos, dashboards de métricas o sistemas de
notificaciones está sobredimensionada para este proyecto. No las sugieras.

---

## Personas

- **Agus** (Agustín Di Mario) — el que desarrolla. Estudiante de 3° año de
  Ingeniería en Informática en la UCC. Habla y escribe en español rioplatense.
  Responde bien a que le discutan las ideas; no le endulces las cosas ni
  valides una decisión mala por evitar fricción.
- **Aaron** — secretario de grado de la facultad. Encargó la app. No es
  programador pero usa Apps Script habitualmente. **Es quien va a mantener
  esto cuando Agus se reciba.** Esa restricción manda sobre las decisiones
  de arquitectura.

---

## Por qué Apps Script (decisión cerrada, no reabrir)

Se evaluó contra un stack propio (Docker + microservicios, que es donde Agus
tiene experiencia). Ganó Apps Script por:

1. Generar el documento es el 80% del trabajo, y `DocumentApp` + plantilla de
   Docs lo resuelve en ~30 líneas conservando el formato institucional.
2. Auth institucional gratis vía el Google Workspace de la facultad.
3. El mail sale desde la cuenta institucional, con reputación de dominio.
4. Cero hosting. Una facultad no pone una tarjeta de crédito para el proyecto
   de un alumno.
5. **El factor decisivo:** cuando Agus se reciba, Aaron tiene que poder
   abrirlo. Un sistema que solo Agus puede tocar es un pasivo para la facultad.

Agus tuvo (y tiene) reservas legítimas sobre el ecosistema. Se resolvieron con
`clasp` + Git + Claude Code, sin cambiar de plataforma. **No propongas migrar
a otro stack.** Si aparece una limitación real de Apps Script, decila
concretamente en vez de sugerir un rewrite.

---

## Estructura del repo

```
Código.js       Toda la lógica de negocio.
WebApp.js       doGet() + endpoint subirYGenerar(). Solo el borde HTTP/UI.
Index.html      Pantalla de subida (HTML+CSS+JS inline, como pide HtmlService).
appsscript.json Manifest. Ver la sección "Deploy" antes de tocarlo.
.clasp.json     scriptId y rootDir.
CLAUDE.md       Este archivo.
README.md       Portada corta; remite acá.
```

**Flujo de llamadas:** `Index.html` → `google.script.run.subirYGenerar()`
(`WebApp.js`) → guarda la ficha en la carpeta de salida → `fichaANota()` →
`procesarFicha()` (`pdfATexto` → `extraerFicha` → `leerPlan` / `leerCalendario`
→ `armarDatosNota`) → `aprobarYGenerar()` → `generarNota()` → borra la ficha en
el `finally`. `procesarFicha` y `aprobarYGenerar` están separadas para poder
mostrar los datos antes de generar, aunque la web app hoy hace todo de una.

`pdfATexto()` usa el **servicio avanzado de Drive** (`Drive.Files.create`),
habilitado en `appsscript.json` (`enabledAdvancedServices`, v3). No es lo mismo
que `DriveApp`: si se saca del manifest, la conversión PDF→Doc deja de andar.

`Código.js` está dividido en secciones con separadores de comentario:
**CONFIG · LÓGICA · DATOS · PDF→TEXTO · GENERACIÓN · ORQUESTACIÓN · PRUEBAS**.

Las funciones de **LÓGICA** son puras a propósito: no llaman a
`DriveApp`/`SpreadsheetApp`/`DocumentApp`. Eso permite testearlas sin red y
portarlas si algún día el proyecto se absorbe en otro sistema. **Mantené esa
separación** — no metas una llamada a un servicio de Google dentro de una
función de esa sección.

---

## Recursos externos al repo

No están en Git ni los maneja clasp. Sus IDs viven en `CONFIG` al tope de
`Código.js`:

| Recurso | Qué es | Permiso que necesita la cuenta que ejecuta | Dueño (al 2026-09-21) |
|---|---|---|---|
| `ID_PLANILLA` | Google Sheets "Planes", con las hojas `Planes` y `Calendario` | Lector | `grado.fi@ucc.edu.ar` |
| `ID_PLANTILLA` | Google Doc "A quien corresponda_", con el texto y los placeholders | Lector | `grado.fi@ucc.edu.ar` |
| `ID_CARPETA_SALIDA` | Carpeta `SALIDAS`, donde se dejan los PDF generados | **Editor** | `grado.fi@ucc.edu.ar` |

El proyecto de Apps Script también es de `grado.fi@ucc.edu.ar` (cuenta de área
de la Secretaría). Los cuatro se recrearon el 2026-09-08; los IDs anteriores
(`1W0EyQ…`, `1bHVdG…`, `1xpY36…`, proyecto `1pfOnVno…`) ya no se usan.

**Los cuatro recursos ya son de `grado.fi`.** La planilla y la plantilla
estuvieron un tiempo a nombre de la cuenta de alumno de Agus; se transfirieron
el 2026-09-21 (confirmado por API de Drive, no solo por UI).

La carpeta de salida tiene que estar compartida como **Editor** con la cuenta
que ejecuta: la app crea archivos ahí. Sin eso, todo lo demás anda y falla
recién al generar. Ver "`Access denied: DriveApp` no significa lo que parece".
Con qué rol entra hoy la cuenta que ejecuta a `SALIDAS`: **sin verificar**
(correr `probarAccesos()`).

### Hoja `Planes`

Una fila por carrera. La clave de búsqueda es `clave` = `cod_carrera-plan`
(ej: `17-2023`), que se arma con dos datos que salen de la misma línea
`CARRERA:` de la ficha.

Columnas: `clave, cod_carrera, plan, carrera, duracion_anios,
cantidad_materias, acred_ingles, acred_rsu, items_plan, inicio_actividad`.

Las últimas cuatro son documentación de cómo se derivó `cantidad_materias`;
el código solo usa `carrera`, `duracion_anios` y `cantidad_materias`.

Contenido actual (las 10 carreras de la facultad, confirmado — no hay más):

| clave | carrera | años | materias |
|---|---|---|---|
| 18-2025 | Tecnicatura Universitaria en Ciencia de Datos | 3 | 28 |
| 19-2025 | Tecnicatura Universitaria en Desarrollo de Software | 3 | 25 |
| 14-2023 | Licenciatura en Bioinformática | 4 | 47 |
| 20-2025 | Licenciatura en Inteligencia Artificial y Ciencia de Datos | 4 | 49 |
| 03-2023 | Ingeniería Civil | 5 | 75 |
| 09-2023 | Ingeniería Electrónica | 5 | 66 |
| 07-2023 | Ingeniería Industrial | 5 | 70 |
| 05-2023 | Ingeniería Mecánica | 5 | 72 |
| 10-2023 | Ingeniería en Computación | 5 | 63 |
| 17-2023 | Ingeniería en Informática | 5 | 62 |

### Hoja `Calendario`

Columnas: `anio, fin_clases, inicio_clases_siguiente`. Una fila por año.
Cargado: `2026, 13/11/2026, 09/03/2027`.

Cuando llegue 2027 hay que agregar la fila. Si falta el año en curso, el
código no explota: deja las fechas vacías y emite un aviso.

### Plantilla (Doc)

Encabezado con el logo de la UCC (imagen fija, se copia a cada nota).
Placeholders disponibles, todos en mayúsculas y con doble llave:

```
{{NOMBRE}}  {{DNI}}  {{LEGAJO}}  {{INSTITUCION}}  {{CARRERA}}  {{TITULO}}
{{MODALIDAD}}  {{DURACION}}  {{CANT_MATERIAS}}  {{ANIO_INGRESO}}
{{ANIO_ACTUAL}}  {{ANIO_CURSA}}  {{FIN_CLASES}}  {{INICIO_CLASES_SIG}}
```

`generarNota()` reemplaza en body, header y footer. Si agregás una clave al
objeto de datos, queda disponible como placeholder automáticamente (salvo las
que empiezan con `_`, que se filtran).

---

## Reglas de negocio (todas confirmadas con Aaron)

- **Cantidad de materias** = ítems del plan − acreditaciones de inglés − RSU.
  La Práctica Profesional Supervisada **sí** cuenta como materia.
- **La cantidad de acreditaciones de inglés varía por carrera** (1 o 2). Por
  eso está en la hoja y no hardcodeada. No asumas 2.
- **Modalidad**: siempre `Presencial`. No hay carreras híbridas ni a
  distancia. Es constante en `CONFIG`, no columna.
- **Título a obtener**: coincide con el nombre de la carrera en las 10.
  Por eso `TITULO: plan.carrera`.
- **Año de ingreso**: los dos primeros dígitos del ID de alumno son la
  cohorte (`2400520` → 2024). Confirmado por Aaron. Es la fuente de verdad.
- **Año que cursa** = `año actual − año ingreso + 1`, topeado por la duración
  de la carrera (para que a alguien que va lento no le salga "8° año").
- **Plan en la clave**: aunque hoy casi todos los alumnos son plan 2023, la
  búsqueda es por `(carrera, plan)` y si el par no existe **tira error** en
  vez de adivinar. No lo "simplifiques" a buscar solo por carrera: pondría
  una cantidad de materias equivocada en un documento firmado, y es un error
  que nadie detecta de un vistazo.

---

## Cómo se parsea la ficha (hallazgos, no reinvestigar)

La Ficha del Alumno es un PDF generado por **Oracle Reports** (el sistema de
autogestión de la UCC). Tiene capa de texto real, no es escaneo.

`pdfATexto()` la convierte a Google Doc vía Drive API y extrae el texto.
**Esa conversión aplasta el layout de las tablas**, pero:

1. **Las líneas `ALUMNO:` y `CARRERA:` sobreviven** — de hecho Drive las pega
   en una sola línea. Por eso los regex buscan cada campo por su etiqueta y
   no asumen el corte de línea. De ahí salen los 6 campos del alumno.
2. **La tabla de materias queda ilegible** — y no importa: duración y
   cantidad de materias vienen de la hoja `Planes`, no de la ficha.
3. **El bloque `HISTORIA DE ESTA ACTIVIDAD ACADEMICA` se destruye.** Por eso
   el año de ingreso no sale de ahí.

`anioIngresoPorTabla()` saca el mínimo de los años sueltos del volcado, como
chequeo cruzado. Tiene que excluir dos contaminantes, ya identificados
empíricamente:
- `PLAN: 2023` → el año del plan puede ser anterior al ingreso
- fechas `dd-mm-aaaa` → la fecha de inscripción cae en noviembre del año
  anterior al ingreso

Sin esas dos exclusiones el mínimo da mal. **No las saques.**

Casos de borde que faltan verificar con fichas reales (si alguno aparece,
avisarle a Agus, no parchear a ciegas): alumnos con equivalencias de otra
universidad, cambios de carrera, reincorporaciones con años salteados,
apellidos compuestos (el regex de nombre parte por la primera coma).

---

## Deploy (clasp)

**No hay build ni bundler.** Cada archivo del repo es literalmente lo que
corre en Apps Script.

**La fuente de verdad es el proyecto de Apps Script de `grado.fi`**, no el repo
ni GitHub. Se edita también desde el editor web, así que el repo puede quedar
atrás (ya pasó: el 2026-09 el repo apuntaba a un proyecto que ya no existía).
Antes de tocar código: `clasp pull` a una carpeta aparte y comparar con el
repo. Si difieren, gana Apps Script: se trae al repo y se commitea. **Nunca
`clasp push -f` sin esa comparación**: pisa lo remoto sin preguntar.

**Ojo con la versión de clasp.** Estamos en **v3**, que le cambió el nombre a
varios comandos. Mucho tutorial de internet (y las respuestas de un LLM que
no mire esto) están en v2 y fallan con `Unknown command`.

```bash
clasp push -f              # sube el estado local (pisa lo remoto). El -f evita
                           # el prompt: sin él, si cambió appsscript.json, no sube
clasp status               # qué archivos van a subir. Correr si hay dudas
clasp open-script          # abre el editor web (era "clasp open" en v2)
clasp open-web-app         # abre la web app deployada
clasp deployments          # lista deployments con sus IDs
clasp deploy -i ID         # actualiza ESE deployment, conservando su URL
clasp show-authorized-user # con qué cuenta está logueado clasp
clasp logout / clasp login # cambiar de cuenta
```

**Usá siempre `clasp deploy -i ID`.** `clasp deploy` a secas crea un deployment
nuevo con otra URL, y la que ya está repartida queda sirviendo la versión
vieja para siempre. Sacá el ID con `clasp deployments` (es el que tiene
descripción; el `@HEAD` es otra cosa y no se toca).

**Si cambiaste `appsscript.json`, `clasp push` pide confirmación.** En una
terminal no interactiva eso sale como `Skipping push` — no es un error, no
devuelve código distinto de cero, y el `clasp deploy` que venga después
deploya el código viejo tan tranquilo. Usá `clasp push -f` y verificá que
diga `Pushed N files`.

**`clasp push` NO actualiza la URL pública.** La web app sigue sirviendo la
versión vieja hasta que se haga `clasp deploy`. Es el error más común del
ecosistema. Después de cualquier cambio que deba verse en la URL:
`clasp push` **y** `clasp deploy`, y decirle a Agus qué se subió.

### Configuración de la web app en `appsscript.json`

```json
"webapp": {
  "executeAs": "USER_DEPLOYING",
  "access": "DOMAIN"
}
```

`executeAs` **tiene que ser `USER_DEPLOYING`**. Con `USER_ACCESSING` el script
corre con los permisos de quien abre la URL, y cualquier alumno recibiría
"no tienes permiso para acceder a él" al tocar la Planilla, la Plantilla o la
Carpeta — recursos institucionales a los que no tiene ni debe tener acceso.
Con `USER_DEPLOYING` corre siempre con los permisos de quien hizo el último
deploy, que es lo que se busca acá.

`access` **tiene que ser `DOMAIN`**: cualquier alumno con cuenta `@ucc.edu.ar`
abre la URL, y nadie de afuera. Es el requisito del proyecto.

**No lo pongas en `ANYONE` ("Cualquiera").** No significa "cualquier alumno":
significa cualquiera en internet, incluso sin cuenta de Google. La ficha trae
DNI y domicilio; el formulario no puede quedar abierto.

**El deployment puede quedar desincronizado del manifest.** Ya pasó: el repo
decía `MYSELF` y la implementación estaba en `Cualquiera`. Después de un
`clasp deploy`, verificá en *Implementar → Administrar implementaciones →
(lápiz)* que "Usuarios con acceso" diga `Cualquier persona de ucc.edu.ar`.
Lo que vale es lo que dice la UI.

**Quién es "quien hizo el último deploy"**: la cuenta con la que está
autenticado `clasp` en la máquina, no la que tengas abierta en el navegador.
Se consulta con **`clasp show-authorized-user`**. Hoy es `2400520@ucc.edu.ar`.
Cualquier error de permisos se chequea contra **esa** cuenta. Si se deploya
desde el editor web, cuenta la que está logueada ahí; lo confirma el campo
"Ejecutar como" en *Administrar implementaciones*.

Deployment en uso: `AKfycbyynGlujVlmAfv6WFTl51fhCK7huZEuxcq3jNwC486hc7LrGMzpfiDbTu2zoJTNsXgJhg`
(versión 10 al 2026-09-21). El `@HEAD` (`AKfycbxVT3Rq…`) no se toca.

### `oauthScopes`: no están, y es a propósito

El manifest **no declara `oauthScopes`**. Apps Script los infiere solo, leyendo
qué servicios usa el código. Para lo que hace este proyecto, la inferencia
alcanza.

**No los agregues.** Declararlos a mano apaga la inferencia y convierte la
lista en cerrada: a partir de ahí, cada servicio nuevo (`MailApp`,
`UrlFetchApp`, etc.) falla hasta que alguien se acuerde de sumar el scope
correspondiente al manifest. El error que aparece no menciona el manifest por
ningún lado, así que es prácticamente indiagnosticable para quien no sepa que
la lista existe. En un proyecto que mantiene alguien que no programa a diario,
esa trampa cuesta más que la explicitud que da.

Estuvieron declarados un tiempo, agregados durante un debug de permisos
sospechando que la inferencia dejaba afuera el scope de Drive. **No era eso**
(ver abajo). Se sacaron al traspasar el proyecto.

### `Access denied: DriveApp` no significa lo que parece

Este error **no** dice que falte un scope ni que la cuenta no tenga acceso al
archivo. Lo tira `DriveApp` cuando la cuenta tiene el archivo **en modo
lectura** y se intenta **escribir**.

Pasó exactamente eso en agosto de 2026, con la carpeta de salida anterior: era
de `grado.fi@ucc.edu.ar` y `2400520@ucc.edu.ar` no tenía permiso propio sobre
ella (`getAccess` devolvía `NONE`). Todas las lecturas andaban y
`carpeta.createFile()` fallaba.

Durante meses se creyó que estaba "compartida como Lector con Agus". Era una
suposición, nunca un dato: nadie había consultado el permiso. Por eso
`chequearAccesos()` ahora reporta el dueño y el rol efectivo — un diagnóstico
que dice "no podés escribir" sin decir *de quién es* y *cómo entrás* deja el
trabajo a medias.

**La carpeta `ID_CARPETA_SALIDA` requiere permiso de Editor** para la cuenta
que ejecuta, porque la app escribe dos veces ahí: `createFile()` con la ficha
subida (`WebApp.js`) y `makeCopy()` de la plantilla (`generarNota`).

Cómo se leen los errores de Drive:

| Mensaje | Qué significa |
|---|---|
| `Access denied: DriveApp` | Tenés el archivo, pero **de solo lectura**, y estás escribiendo. Pedí Editor. |
| `Requested entity was not found` / no se encontró el archivo | La cuenta **no tiene acceso** a ese archivo. Pedí que te lo compartan. |
| `No tienes permiso para llamar a X. Se requiere el permiso: <url>` | Ahí **sí** falta un scope OAuth. Nombra el scope explícitamente. |

**Al diagnosticar permisos, probá una escritura.** Un chequeo que solo lee da
todo OK con permiso de Lector y manda a buscar el problema donde no está.
`probarAccesos()` incluye un chequeo de escritura por esta razón.

---

## Testing

No hay runner de CLI (Apps Script no tiene). Las funciones de la sección
PRUEBAS de `Código.js` se corren a mano desde el editor (`clasp open-script` → elegir
función → Run):

- `probarAccesos()` — toca los tres recursos de `CONFIG` por separado y dice
  cuál falla. No lee ninguna ficha, así que se corre sin datos de nadie.
  **Correr esta primero ante cualquier error de permisos.** Correrla desde el
  editor es además lo que dispara la pantalla de consentimiento de Google, así
  que es el primer paso para cualquier cuenta nueva que vaya a ejecutar esto.
- `probarLogica()` — lógica pura sobre un texto de muestra con datos
  inventados. Instantánea, no toca Drive ni Sheets. **Correr siempre después
  de tocar la sección LÓGICA.**
- `probarExtraccion()` — extracción sobre una ficha real, sin generar nada.
- `probarCompleto()` — punta a punta, genera el PDF.
- `probarPuntaAPunta()` — **la más útil de todas.** Punta a punta sin datos
  de nadie y sin depender de la carpeta de salida: fabrica la ficha (un Doc con
  el texto de `FICHA_SINTETICA`, exportado a PDF), la procesa y genera la nota
  en una carpeta temporal propia que borra al terminar. Redirige
  `CONFIG.ID_CARPETA_SALIDA` **solo durante esa ejecución**, así que no cambia
  nada del proyecto ni de la web app deployada. Es la única prueba que verifica
  el flujo entero cuando la carpeta de salida todavía no tiene permiso de
  escritura.

Las dos últimas necesitan `ID_FICHA_PRUEBA`, que **va vacío en el repo a
propósito**: una ficha real trae DNI y domicilio, y no corresponde dejar la de
nadie fija en el código. Para usarlas: subir una ficha, pegar su ID, correr, y
volver a vaciar la constante. Si está vacía, las dos cortan con un mensaje que
explica esto mismo.

Si agregás lógica nueva, sumá su caso a `probarLogica()` en el mismo estilo:
asserts a mano con `Logger.log`, sin librería de testing (no hay forma de
instalar una en este runtime).

---

## Convenciones

- **Todo el código y los comentarios en español.** Así habla Agus y así lo va
  a leer Aaron.
- camelCase, punto y coma siempre.
- IDs y constantes en `CONFIG`, nunca hardcodeados en el cuerpo de una función.
- Cuando algo puede afectar la corrección de un documento institucional
  (falta un plan, falta el calendario), `throw new Error()` con mensaje
  accionable. Nada de defaults silenciosos. Ver `leerPlan()` como referencia.
- **`_avisos`**: para datos inciertos pero no bloqueantes. El diseño busca que
  Aaron **no toque nada** en el caso normal — abre, mira, firma. Un aviso que
  salta siempre es ruido y entrena a ignorarlos. Solo agregá uno cuando el
  valor puede estar genuinamente mal y conviene que un humano confirme antes
  de firmar.

---

## Privacidad

Las fichas tienen DNI, domicilio y el historial académico completo del alumno.

- `subirYGenerar()` borra la ficha subida apenas se procesa (ver el `finally`).
  **No cambies ese comportamiento sin que te lo pidan.**
- No agregues logging que persista DNI, nombres completos o domicilios.
- **No dejes datos de nadie hardcodeados**, ni siquiera para pruebas.
  `probarLogica()` usa un alumno inventado y `ID_FICHA_PRUEBA` va vacío.
- Para probar con una ficha real, usar una de alguien que haya dado el ok, y
  vaciar `ID_FICHA_PRUEBA` cuando termines.
- "Borrar" en Drive es mandar a la papelera: la ficha que borra
  `subirYGenerar()` queda 30 días en la papelera de la cuenta que ejecuta la
  app. Conviene vaciarla cada tanto.
- **El PDF generado se comparte solo con el alumno que lo pidió.** La app corre
  como quien deployó, así que el PDF nace sin acceso para el alumno.
  `generarNota()` le da Lector con `addViewer(Session.getActiveUser().getEmail())`.
  Si ese mail viene vacío, **tira error antes de crear ningún archivo**. No
  hay fallback a compartir por link: antes había `DOMAIN_WITH_LINK`, y dejaba
  la constancia con DNI visible para todo el dominio. No lo vuelvas a poner.

---

## Pendientes

- Sin verificar con qué cuenta corre la web app ("Ejecutar como" en
  *Administrar implementaciones*). No es urgente.
- `Session.getActiveUser().getEmail()` ya se usa para compartir el PDF. Se
  podría usar también para sacar pasos manuales del formulario.
- Fila del calendario 2027 cuando se defina.
