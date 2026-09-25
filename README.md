# Nota Institucional - Work and Travel

Google Apps Script de la Facultad de Ingeniería (UCC). Genera la constancia de
alumno regular que piden los alumnos para trámites de Work and Travel.

**Flujo:** el alumno descarga el consentimiento en PDF, lo firma y lo sube
junto con el PDF de su Ficha del Alumno en una web app → se extraen sus datos
→ se cruzan contra dos hojas de referencia (`Planes` y `Calendario`) → sale la
constancia en PDF, lista para firmar, y el envío queda anotado en la planilla
`SALIDAS/Registro de consentimientos`.

## Documentación

Antes de tocar algo, leer:

- **[`CLAUDE.md`](./CLAUDE.md)** — documentación técnica completa: por qué
  Apps Script, reglas de negocio confirmadas, cómo se parsea la ficha, cómo
  deployar con `clasp`, y errores conocidos con su causa real.

## Estructura

```
Config.js         Overview del proyecto + objeto CONFIG.
Logica.js         Funciones puras: parseo de la ficha, cálculos, armado de datos.
Datos.js          Lectura de las hojas Planes y Calendario (Sheets).
PdfATexto.js      Conversión del PDF de la ficha a texto (Drive).
Generacion.js     Genera el PDF de la nota a partir de la plantilla (Docs).
Orquestacion.js   Casos de uso: procesarFicha, aprobarYGenerar, fichaANota.
Mantenimiento.js  blindarPlanilla(), se corre a mano desde el editor.
Pruebas.js        Funciones probar* y datos de prueba.
WebApp.js         doGet() + el endpoint subirYGenerar() + registro de envíos.
Index.html        Pantalla de subida.
appsscript.json   Manifest de Apps Script.
.clasp.json       scriptId y configuración de clasp.
```

Apps Script no tiene módulos: todos los `.js` se mezclan en un mismo scope
global al ejecutar, así que esta separación es de organización, no de
aislamiento.

Los recursos externos (planilla, plantilla, carpeta de salida) no viven en
este repo — sus IDs están en el objeto `CONFIG` de `Config.js`. Detalle en
`CLAUDE.md`.

## Deploy

No hay build ni bundler: cada archivo del repo es literalmente lo que corre
en Apps Script.

```bash
clasp push -f              # sube el código (no actualiza la URL pública)
clasp deploy -i <ID>       # sí actualiza la URL pública
```

Ver la sección **Deploy** de `CLAUDE.md` antes de correr esto — hay más de una
trampa documentada ahí (versión de `clasp`, `oauthScopes`, `executeAs`).

## Pruebas

No hay runner de CLI. Las funciones de `Pruebas.js` se corren a mano desde
el editor de Apps Script (`clasp open-script`):

- `probarAccesos()` — primero ante cualquier error de permisos.
- `probarLogica()` — lógica pura, instantánea, sin tocar Drive ni Sheets.
- `probarPuntaAPunta()` — punta a punta con datos inventados, sin depender
  de ninguna ficha ni carpeta real.

Detalle de cada una en `CLAUDE.md`.
