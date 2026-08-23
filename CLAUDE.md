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
```

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

| Recurso | Qué es |
|---|---|
| `ID_PLANILLA` | Google Sheets con las hojas `Planes` y `Calendario` |
| `ID_PLANTILLA` | Google Doc con el texto de la nota y los placeholders |
| `ID_CARPETA_SALIDA` | Carpeta de Drive donde se dejan los PDF generados |

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

```bash
clasp push          # sube el estado local al proyecto (pisa lo remoto)
clasp status        # qué archivos van a subir. Correr si hay dudas.
clasp open          # abre el editor web (para correr funciones de prueba)
clasp deploy        # crea una NUEVA versión del deployment
clasp deployments   # lista deployments con sus IDs
```

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

`access` es `DOMAIN` para restringirlo al dominio de la UCC. Durante el
desarrollo en la cuenta personal de Agus puede estar en `MYSELF`.

---

## Testing

No hay runner de CLI (Apps Script no tiene). Las funciones de la sección
PRUEBAS de `Código.js` se corren a mano desde el editor (`clasp open` → elegir
función → Run):

- `probarLogica()` — lógica pura sobre un texto de muestra. Instantánea, no
  toca Drive ni Sheets. **Correr siempre después de tocar la sección LÓGICA.**
- `probarExtraccion()` — extracción sobre una ficha real, sin generar nada.
- `probarCompleto()` — punta a punta, genera el PDF.

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
- Para probar, usar la ficha del propio Agus o de alguien que dio el ok.
  Fichas de alumnos reales en la cuenta personal es un problema que no
  queremos.

---

## Pendientes

- Acceso al Workspace institucional de la UCC (Agus desarrolla desde su cuenta
  personal). Cuando llegue: copiar los tres archivos, recrear planilla y
  plantilla allá, actualizar `CONFIG`, deployar con `access: DOMAIN`.
- Con el Workspace institucional se puede usar
  `Session.getActiveUser().getEmail()` para identificar al alumno
  automáticamente y sacar pasos manuales del formulario.
- Fila del calendario 2027 cuando se defina.
