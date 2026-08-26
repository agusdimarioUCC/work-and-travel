# Traspaso a `grado.ing@ucc.edu.ar`

Sacar el proyecto de `2400520@ucc.edu.ar` (cuenta de alumno de Agus) y dejarlo a
nombre de la Secretaría de Grado. Una hora, presencial.

> **Estado al 25/08/2026.** El código funciona: `probarPuntaAPunta()` generó
> una constancia completa y correcta (5 años, 62 materias, 3° año, las dos
> fechas del calendario, sin avisos), ejercitando conversión del PDF, parseo,
> las dos hojas, la plantilla y el export.
>
> **Lo único que falla es escribir en la carpeta de salida.** `probarAccesos()`
> da OK en todas las lecturas y FALLA en la escritura: `Access denied: DriveApp`.
> El alumno ve ese mensaje.
>
> **La causa, verificada:** `entro como NONE, dueño grado.fi@ucc.edu.ar`.
> `2400520@ucc.edu.ar` no tiene ningún permiso propio sobre esa carpeta — la ve
> por herencia del dominio, y por eso lee pero no escribe.
>
> **Se destraba con un permiso de Editor** para la cuenta que ejecuta, otorgado
> por `grado.fi@ucc.edu.ar`, que es la dueña. O, mejor, se vuelve innecesario en
> cuanto la app se ejecute *como* esa cuenta: **el traspaso arregla este bug por
> construcción**, porque el dueño de los archivos y el que ejecuta pasan a ser
> la misma cuenta y no queda nada que sincronizar.

## Antes de ir

El código ya está limpio en el repo. Falta subirlo:

```bash
clasp push -f       # tiene que decir "Pushed N files"
clasp open-script   # correr probarLogica() -> Logger dice OK
                    # correr probarAccesos() -> vuelve a pedir permisos, es esperado
clasp deploy -i AKfycbxWChmSXMO17PWs_9PMdq7SUEclWTUPLXRcMcIgekOdo9XdLKWWgbUjUKdcJcuBK64_bA
```

Ese es el deployment repartido. **Nunca `clasp deploy` a secas**: crea otro con
otra URL.

Llevá tu notebook, una ficha PDF para probar, y el repo en un zip.

## En la oficina

**1. Definir cuál de las dos cuentas de área es el destino, y entrar con ella.**

Aparecieron dos, parecidas y distintas:

- **`grado.fi@ucc.edu.ar`** — es la **dueña actual de la carpeta de salida**
  (verificado). O sea, parte del proyecto ya está a su nombre.
- **`grado.ing@ucc.edu.ar`** — Secretaría de Grado y Proyección Social, la que
  figura como contacto.

Preguntale a Aaron cuál se usa y para qué. Si son la misma secretaría con dos
direcciones, **el destino natural es `grado.fi`**: ya es dueña de un recurso del
proyecto, así que elegir la otra significa mover esa carpeta también, sin
ganancia.

- [ ] Que Aaron **inicie sesión** con la cuenta elegida, en una ventana de
      incógnito. Si no puede entrar con ninguna, es un alias de mail y no sirve
      como destino: transferí todo a su cuenta personal y el resto del guión es
      igual.

Dejá esa ventana abierta: es la sesión de la cuenta destino. Lo tuyo, en tu
notebook.

**2. Transferir los archivos.** En Drive: compartir como Editor, y ahí el
desplegable ofrece "Transferir propiedad".

Vos, como `2400520`:
- El proyecto de Apps Script (`1pfOnVnoraqCmTbEAo5XMzYK_UpIicmexLNcdDPDtXR4pAgVndV-mWDr9`)
- La planilla (`1W0EyQSpzkPm9oFQaB7bM7mY9PBFeElqTN5kFbXlMNrc`)
- La plantilla (`1bHVdGrIONdfZ_FMpG4jCDdOqWYZVr6eT7TOg06vW9E8`)
- Los PDF ya generados en la carpeta de salida: los creó la app corriendo como
  vos, así que son tuyos. Si son de prueba, borralos.

**La carpeta de salida** (`1xpY367mDJiUwtecAr_nJtmRTJILrDOub`) **no hay que
transferirla**: ya es de `grado.fi@ucc.edu.ar`. Si el destino elegido es
`grado.fi`, no se toca. Si es otra cuenta, entonces sí hay que transferirla, y
quien puede hacerlo es `grado.fi`, no Aaron a título personal.

Como `grado.ing`: aceptar las transferencias si llega el pedido por mail (dentro
del mismo dominio a veces son inmediatas) y verificar en Detalles → Propietario
que los cuatro digan `grado.ing`.

**3. Autorizar y redeployar, como `grado.ing`.** Esto es lo que hace que la app
deje de correr con tu cuenta. Transferir los archivos **no** alcanza.

- Abrir el proyecto y correr `probarAccesos()`. Salta la pantalla de permisos de
  Google: eso es lo que le da a `grado.ing` su propia autorización. Las seis
  líneas tienen que dar OK, y `usuario efectivo` tiene que decir `grado.ing`.
  Si falla `Drive avanzado`: Servicios → + → Drive API v3 → Agregar.
- Implementar → Administrar implementaciones → (lápiz) → Versión: **Nueva
  versión** → Implementar. Sobre el que ya existe, **no** "Nueva
  implementación": eso crea otra URL.
- Verificar ahí mismo: **Ejecutar como: `grado.ing@ucc.edu.ar`**. Si dice otra
  cosa, no quedó.
- Archivar el deployment `@HEAD` (`AKfycbzVqNCz7Om3GObi...`), que no se usa.

**4. Probar, desde tu notebook con tu cuenta de alumno.** No desde `grado.ing`:
el caso real es un alumno usando una app que corre como la Secretaría. Subir la
ficha, generar la nota, y confirmar que el PDF quedó con `grado.ing` como
propietario.

**5. Dejar el zip del repo y `CLAUDE.md` en la carpeta del proyecto.** Es la
única copia: el repo no tiene remote.

**6. Desconectarte.** Solo si el paso 4 salió bien.

- Que `grado.ing` te saque el acceso.
- Revocar el script en `myaccount.google.com/permissions` como `2400520`.
- Vaciar tu papelera: la app manda ahí las fichas subidas, y tienen DNI.
- `clasp logout`.
- Cerrar la ventana de incógnito en la máquina de Aaron.

## Errores que van a aparecer

Para que no te llamen a vos. El mensaje sale en pantalla, completo.

| Dice | Qué es | Lo arregla |
|---|---|---|
| `No hay plan cargado para la clave 17-2023` | Falta esa carrera/plan en la hoja `Planes` | La Secretaría: agregar la fila |
| `Falta el calendario académico del año XXXX` | No es error: la nota **sale igual con el fin de clases en blanco**. Va a pasar en 2027 | La Secretaría: agregar la fila en `Calendario` |
| `Falta el campo: ALUMNO` / `DOC` / `CARRERA` | Subió un PDF que no es la ficha | El alumno |
| `Access denied: DriveApp` | Algo quedó de solo lectura | La Secretaría: correr `probarAccesos()` |
| `Requested entity was not found` | La cuenta perdió acceso a algún recurso | La Secretaría: `probarAccesos()` dice cuál |

Agregar carreras y años en la planilla, y cambiar el texto de la nota en la
plantilla del Doc, no requiere tocar código.
