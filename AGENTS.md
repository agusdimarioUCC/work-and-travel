# Repository Guidelines

## Estructura del proyecto

Aplicación de Google Apps Script sin módulos, build ni bundler: todos los archivos JavaScript comparten ámbito global. `Logica.js` contiene funciones puras; `Datos.js`, `PdfATexto.js` y `Generacion.js` integran servicios de Google; `Orquestacion.js` coordina los casos de uso; `WebApp.js` expone la interfaz web y `Index.html` contiene su pantalla. `Config.js` centraliza la configuración. `Pruebas.js` contiene las pruebas manuales y `Mantenimiento.js`, tareas administrativas. `graphify-out/` es salida generada; no editarla como código fuente. Consultar `CLAUDE.md` antes de cambiar comportamiento: documenta arquitectura, reglas confirmadas y restricciones operativas.

## Desarrollo y despliegue

No hay comandos de build, lint ni pruebas de CLI. Abrir Apps Script: `clasp open-script`. Ejecutar allí `probarLogica()` después de cambios en lógica; `probarPuntaAPunta()` cubre el flujo completo con datos sintéticos y recursos temporales. `probarAccesos()` diagnostica permisos. `clasp run` no es compatible con este proyecto.

Apps Script remoto es la fuente de verdad. Antes de editar código, hacer `clasp pull` en una carpeta aparte y comparar los archivos; conciliar cambios remotos antes de continuar. No publicar sin autorización explícita. Si se autoriza un despliegue, seguir `CLAUDE.md`: usar `clasp push -f`, comprobar que se subieron archivos y actualizar el deployment existente mediante `clasp deploy -i <ID>`.

## Estilo y cambios

Escribir código y comentarios en español, con nombres `camelCase` y punto y coma. Mantener `Logica.js` libre de servicios de Google. Guardar IDs y constantes en `CONFIG`, no dentro de funciones. Ante datos faltantes que puedan producir una constancia incorrecta, fallar con un error claro y accionable; evitar valores predeterminados silenciosos. Agregar casos de lógica a `probarLogica()` usando datos inventados y asserts sencillos con `Logger.log`.

## Privacidad y configuración

No registrar ni incorporar datos personales reales en código, fixtures o pruebas. Mantener vacía `ID_FICHA_PRUEBA` en el repositorio. La ficha subida se elimina al procesarse; el consentimiento firmado se conserva como evidencia. Los PDF generados se comparten únicamente con el alumno. No habilitar acceso público ni cambiar los permisos del deployment: debe ser solo para el dominio (`DOMAIN`). No agregar `oauthScopes` manuales; Apps Script los infiere.

## Commits y pull requests

El historial usa mensajes breves en español que describen el cambio directamente, por ejemplo: `Corrige ...`, `Actualiza ...`, `Documenta ...`. Seguir ese estilo. En cada PR, resumir el motivo y los cambios; indicar las comprobaciones manuales realizadas y cualquier cambio de configuración o deployment. No incluir datos personales ni IDs sensibles.

