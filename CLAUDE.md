# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Nota Institucional - Work and Travel (UCC)

Google Apps Script. Genera la constancia de alumno regular que piden los
alumnos de la Facultad de Ingeniería de la Universidad Católica de Córdoba
para trámites de Work and Travel.

**Flujo completo:** el alumno sube el PDF de su Ficha del Alumno y su
consentimiento firmado (digital o escaneado/fotografiado) en una web app → se
extraen los datos de la ficha → se cruzan contra dos hojas de referencia →
sale la constancia en PDF y se le comparte al alumno → el alumno la imprime y
se la lleva a Aaron, que la firma en papel.

**Confirmado con Aaron (2026-09-21):** la firma es en papel, fuera de la app.
El PDF que genera la web app **no** se firma digitalmente ni Aaron lo revisa
antes de que el alumno lo reciba — el alumno recibe el link apenas se genera,
tal como funciona hoy. No agregues un paso de revisión/firma digital: no
hace falta.

**Volumen:** menos de 100 constancias por temporada. Cualquier propuesta de
colas de trabajo, reintentos, dashboards de métricas o sistemas de
notificaciones está sobredimensionada para este proyecto. No las sugieras.

---

## Personas

- **Agus** — el que desarrolla, estudiante de Informática. Español
  rioplatense. Discutile las ideas; no valides una decisión mala por evitar
  fricción.
- **Aaron** — secretario de grado, encargó la app. No es programador pero usa
  Apps Script. **Es quien lo va a mantener**, y eso manda sobre la
  arquitectura.

---

## Por qué Apps Script (decisión cerrada, no reabrir)

Ganó contra un stack propio porque Aaron tiene que poder mantenerlo, y además
da gratis la plantilla de Docs, la autenticación del Workspace y cero hosting.
**No propongas migrar a otro stack.** Si aparece una limitación real de Apps
Script, decila concretamente en vez de sugerir un rewrite.

---

## Estructura

`Codigo.js` tiene toda la lógica; `WebApp.js` es solo el borde HTTP
(`doGet` y `subirYGenerar`); `Index.html` es la pantalla de subida.

**Flujo de llamadas:** `Index.html` → `google.script.run.subirYGenerar()`
(`WebApp.js`) → guarda la ficha en la carpeta de salida → `fichaANota()` →
`procesarFicha()` (`pdfATexto` → `extraerFicha` → `leerPlan` / `leerCalendario`
→ `armarDatosNota`) → `aprobarYGenerar()` → `generarNota()` → guarda el
consentimiento firmado en `SALIDAS/Consentimientos` → borra la ficha en el
`finally`. `procesarFicha` y `aprobarYGenerar` están separadas para poder
mostrar los datos antes de generar, aunque la web app hoy hace todo de una.

**Consentimiento firmado:** desde 2026-09, `subirYGenerar` también recibe el
consentimiento firmado del alumno (PDF o foto/escaneo en jpg/png). A
diferencia de la ficha, **se conserva** (es la prueba de que el alumno
aceptó): queda en `SALIDAS/Consentimientos`, subcarpeta que crea sola
`carpetaConsentimientos()` (`WebApp.js`) la primera vez que hace falta — no
tiene ID propio en `CONFIG`. El consentimiento no se parsea ni se valida su
contenido, solo se guarda; si `fichaANota()` falla, no se guarda.

`pdfATexto()` usa el **servicio avanzado de Drive** (`Drive.Files.create`),
habilitado en `appsscript.json` (`enabledAdvancedServices`, v3). No es lo mismo
que `DriveApp`: si se saca del manifest, la conversión PDF→Doc deja de andar.

`Codigo.js` está dividido en secciones con separadores de comentario:
**CONFIG · LÓGICA · DATOS · PDF→TEXTO · GENERACIÓN · ORQUESTACIÓN · MANTENIMIENTO · PRUEBAS**.

Las funciones de **LÓGICA** son puras a propósito: no llaman a
`DriveApp`/`SpreadsheetApp`/`DocumentApp`. Eso permite testearlas sin red y
portarlas si algún día el proyecto se absorbe en otro sistema. **Mantené esa
separación** — no metas una llamada a un servicio de Google dentro de una
función de esa sección.

---

## Recursos externos al repo

No están en Git ni los maneja clasp. Sus IDs viven en `CONFIG` al tope de
`Codigo.js`:

| Recurso | Qué es | Permiso que necesita la cuenta que ejecuta | Dueño (al 2026-09-21) |
|---|---|---|---|
| `ID_PLANILLA` | Google Sheets "Planes", con las hojas `Planes` y `Calendario` | Lector | `grado.fi@ucc.edu.ar` |
| `ID_PLANTILLA` | Google Doc "A quien corresponda_", con el texto y los placeholders | Lector | `grado.fi@ucc.edu.ar` |
| `ID_CARPETA_SALIDA` | Carpeta `SALIDAS`, donde se dejan los PDF generados | **Editor** | `grado.fi@ucc.edu.ar` |

El proyecto de Apps Script también es de `grado.fi@ucc.edu.ar` (cuenta de área
de la Secretaría).

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
el código solo usa `carrera`, `duracion_anios` y `cantidad_materias`. Son las
10 carreras de la facultad (confirmado, no hay más); el contenido vive en la
planilla, no acá.

### Hoja `Calendario`

Columnas: `anio, fin_clases, inicio_clases_siguiente`. Una fila por año.
Cargado: `2026, 13/11/2026, 09/03/2027`.

Cuando llegue 2027 hay que agregar la fila. Si falta el año en curso, el
código no explota: deja las fechas vacías y emite un aviso.

### Cómo se protege la planilla

- **En el código:** las dos hojas se leen por **nombre de columna**
  (`ubicarColumnas`), nunca por posición, y `validarPlan` exige enteros
  positivos. Si falta una columna o un valor no sirve, tira error: antes una
  celda con texto terminaba como "NaN años" en la nota, sin aviso.
- **En la planilla:** `blindarPlanilla()` (sección MANTENIMIENTO) protege los
  encabezados con advertencia, pone validación por columna y deja `clave` en
  formato texto. Se corre a mano desde el editor, y otra vez si se recrea la
  planilla. Al final loguea las celdas ya cargadas que no cumplen.

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
atrás. Antes de tocar código: `clasp pull` a una carpeta aparte y comparar con el
repo. Si difieren, gana Apps Script: se trae al repo y se commitea. **Nunca
`clasp push -f` sin esa comparación**: pisa lo remoto sin preguntar.

**Estamos en clasp v3**, que renombró varios comandos. Lo que está en internet
suele ser v2 y falla con `Unknown command`.

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

**Usá siempre `clasp deploy -i ID`.** A secas crea un deployment nuevo con
otra URL, y la repartida queda sirviendo la versión vieja para siempre.

**Sin `-f`, si cambió `appsscript.json`, `clasp push` no sube nada**: en una
terminal no interactiva dice `Skipping push` y sale con código 0. Verificá que
diga `Pushed N files`.

**`clasp push` NO actualiza la URL pública**; eso lo hace `clasp deploy`.
Después de cualquier cambio que deba verse en la URL: los dos, y decirle a
Agus qué se subió.

### Configuración de la web app en `appsscript.json`

```json
"webapp": {
  "executeAs": "USER_DEPLOYING",
  "access": "DOMAIN"
}
```

`executeAs` **tiene que ser `USER_DEPLOYING`**: con `USER_ACCESSING` corre con
los permisos del alumno, que no tiene (ni debe tener) acceso a la planilla, la
plantilla ni la carpeta.

`access` **tiene que ser `DOMAIN`**. **Nunca `ANYONE`**: no significa
"cualquier alumno" sino cualquiera en internet, y la ficha trae DNI y
domicilio.

**El deployment puede quedar desincronizado del manifest.** Después de un
`clasp deploy`, verificá en *Implementar → Administrar implementaciones →
(lápiz)* que "Usuarios con acceso" diga `Cualquier persona de ucc.edu.ar`.
Lo que vale es lo que dice la UI.

**"Quien hizo el último deploy"** es la cuenta de `clasp show-authorized-user`
si se deployó con clasp, o la logueada en el editor si se deployó desde ahí.
Los errores de permisos se chequean contra esa cuenta.

Deployment en uso: `AKfycbyynGlujVlmAfv6WFTl51fhCK7huZEuxcq3jNwC486hc7LrGMzpfiDbTu2zoJTNsXgJhg`
(versión 10 al 2026-09-21). El `@HEAD` (`AKfycbxVT3Rq…`) no se toca.

### `oauthScopes`: no están, y es a propósito

Apps Script los infiere del código. **No los agregues**: declararlos apaga la
inferencia, y cada servicio nuevo que se use después falla con un error que no
menciona el manifest. Para quien no programa a diario es indiagnosticable. Si
un error de Drive parece de scopes, leé primero la sección siguiente: casi
nunca lo es.

### `Access denied: DriveApp` no significa lo que parece

Este error **no** dice que falte un scope ni que la cuenta no tenga acceso al
archivo. Lo tira `DriveApp` cuando la cuenta tiene el archivo **en modo
lectura** y se intenta **escribir**. Por eso `chequearAccesos()` reporta el
dueño y el rol efectivo: no supongas permisos, consultalos.

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

No hay runner de CLI (Apps Script no tiene), y **`clasp run <función>` no
sirve como reemplazo**: tira `Error code NOT_FOUND` porque el proyecto no
está vinculado a un GCP estándar. Las funciones de la sección
PRUEBAS de `Codigo.js` se corren a mano desde el editor (`clasp open-script` → elegir
función → Run):

- `probarAccesos()` — toca los tres recursos de `CONFIG` y dice cuál falla,
  con dueño y rol. **Primero ante cualquier error de permisos**, y el primer
  paso para una cuenta nueva (dispara el consentimiento de Google).
- `probarLogica()` — lógica pura con datos inventados, instantánea. **Correr
  siempre después de tocar LÓGICA.**
- `probarPuntaAPunta()` — **la más útil.** Llama a `subirYGenerar()` (la
  función real de la web app) con una ficha fabricada a partir de
  `FICHA_SINTETICA` y un consentimiento sintético, en una carpeta temporal
  que borra al terminar.
- `probarExtraccion()` / `probarCompleto()` — sobre una ficha real. Necesitan
  `ID_FICHA_PRUEBA`, que **va vacío en el repo a propósito** (DNI y
  domicilio): pegar el ID, correr y volver a vaciarlo.

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
- El consentimiento firmado es la excepción a propósito: **se conserva** en
  `SALIDAS/Consentimientos` en vez de borrarse, porque es la prueba de que el
  alumno aceptó. No lo borres para "igualar" el tratamiento de la ficha.
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

- **`blindarPlanilla()` ya corrió contra la planilla real y quedó blindada**
  (encabezados protegidos, validación por columna, log limpio: "Todo lo
  cargado cumple la validación"). Las fórmulas de validación usan `;` como
  separador de argumentos, no `,`: la planilla está en locale `es_ES`, donde
  `,` es el separador decimal y Sheets rechaza la regla entera (hasta
  `=AND(TRUE,TRUE)` fallaba con `,`). No vuelvas a poner `,` en una
  `requireFormulaSatisfied()` de este archivo. Falta deployar
  (`clasp deploy -i AKfycbyynGlu...`).
- Sin verificar con qué cuenta corre la web app ("Ejecutar como" en
  *Administrar implementaciones*). No es urgente.
- `Session.getActiveUser().getEmail()` ya se usa para compartir el PDF. Se
  podría usar también para sacar pasos manuales del formulario.
- Fila del calendario 2027 cuando se defina.
