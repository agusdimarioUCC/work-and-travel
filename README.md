# Nota Institucional - Work and Travel

Google Apps Script de la Facultad de Ingeniería (UCC). Genera la constancia de
alumno regular que piden los alumnos para trámites de Work and Travel.

**Flujo:** el alumno sube el PDF de su Ficha del Alumno en una web app → se
extraen sus datos → se cruzan contra dos hojas de referencia (`Planes` y
`Calendario`) → sale la constancia en PDF, lista para firmar.

## Documentación

Antes de tocar algo, leer:

- **[`CLAUDE.md`](./CLAUDE.md)** — documentación técnica completa: por qué
  Apps Script, reglas de negocio confirmadas, cómo se parsea la ficha, cómo
  deployar con `clasp`, y errores conocidos con su causa real.
- **[`TRASPASO.md`](./TRASPASO.md)** / [`TRASPASO.pdf`](./TRASPASO.pdf) —
  guión paso a paso para pasar el proyecto de la cuenta de alumno a la cuenta
  institucional de la Secretaría.

## Estructura

```
Código.js       Toda la lógica de negocio, dividida en secciones:
                CONFIG · LÓGICA · DATOS · PDF→TEXTO · GENERACIÓN ·
                ORQUESTACIÓN · PRUEBAS
WebApp.js       doGet() + el endpoint subirYGenerar(). Solo el borde HTTP/UI.
Index.html      Pantalla de subida.
appsscript.json Manifest de Apps Script.
.clasp.json     scriptId y configuración de clasp.
```

Los recursos externos (planilla, plantilla, carpeta de salida) no viven en
este repo — sus IDs están en `CONFIG`, al tope de `Código.js`. Detalle en
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

No hay runner de CLI. Las funciones de la sección `PRUEBAS` de `Código.js` se
corren a mano desde el editor de Apps Script (`clasp open-script`):

- `probarAccesos()` — primero ante cualquier error de permisos.
- `probarLogica()` — lógica pura, instantánea, sin tocar Drive ni Sheets.
- `probarPuntaAPunta()` — punta a punta con datos inventados, sin depender
  de ninguna ficha ni carpeta real.

Detalle de cada una en `CLAUDE.md`.
