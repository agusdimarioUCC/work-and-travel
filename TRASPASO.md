# Traspaso a `grado.fi@ucc.edu.ar`

Sacar el proyecto de `2400520@ucc.edu.ar` (cuenta de alumno de Agus) y dejarlo a
nombre de `grado.fi@ucc.edu.ar` — Secretaría de Grado. Confirmado con Aaron.
Una hora, presencial.

> **Estado al 21/09/2026 — el traspaso está a medias.** El 08/09 se recreó
> todo en un proyecto nuevo:
>
> | Recurso | ID | Dueño |
> |---|---|---|
> | Proyecto "Work & Travel" | `1prkWjxzyIxLZc2nzymPBYZ4jYbpMmYwuYtASUl4Sj97KhPUSbF6jr1wl` | `grado.fi` ✓ |
> | Carpeta `SALIDAS` | `1xYDMz4UdAeQWr8X7Opaqg8Ey3Skf3mI5` | `grado.fi` ✓ |
> | Planilla "Planes" | `1U0IEygsMU0hsesUHbmhNiMD6fSwaPE4fS7lqmaBPJ04` | **`2400520`** ✗ |
> | Plantilla "A quien corresponda_" | `1jhI-qM0_Yd1HdbCA9W0QlbYjbX4Llap8-Q-SA3hgbb0` | **`2400520`** ✗ |
>
> Faltan dos cosas: **transferir la planilla y la plantilla** (paso 2) y
> **que el último deploy lo haga `grado.fi`** (paso 3). Mientras el deploy
> sea de `2400520`, la app corre con los permisos de Agus y deja de andar el
> día que se dé de baja su cuenta.
>
> El proyecto viejo (`1pfOnVno…`), su deployment (`AKfycbxWChmSX…`) y sus
> recursos ya no existen o no se usan.

## Antes de ir

No hay código para subir: el repo, el editor y el deployment en uso (versión 9)
tienen el mismo código al 21/09. Solo verificar:

```bash
clasp open-script   # correr probarLogica() -> Logger dice OK
                    # correr probarAccesos() -> todo OK
```

El deployment repartido es
`AKfycbyynGlujVlmAfv6WFTl51fhCK7huZEuxcq3jNwC486hc7LrGMzpfiDbTu2zoJTNsXgJhg`.
Si hay que actualizarlo: `clasp deploy -i <ese ID>`. **Nunca `clasp deploy` a
secas**: crea otro con otra URL.

Llevá tu notebook, una ficha PDF para probar, y el repo en un zip.

## En la oficina

**1. Que Aaron inicie sesión con `grado.fi@ucc.edu.ar`**, en una ventana de
incógnito. Si no puede entrar, es un alias de mail y no sirve como destino:
transferí todo a su cuenta personal y el resto del guión es igual.

Dejá esa ventana abierta: es la sesión de `grado.fi`. Lo tuyo, en tu notebook.

**2. Transferir los archivos.** En Drive: compartir como Editor, y ahí el
desplegable ofrece "Transferir propiedad".

Vos, como `2400520`, transferís a `grado.fi`:
- La planilla "Planes" (`1U0IEygsMU0hsesUHbmhNiMD6fSwaPE4fS7lqmaBPJ04`)
- La plantilla "A quien corresponda_" (`1jhI-qM0_Yd1HdbCA9W0QlbYjbX4Llap8-Q-SA3hgbb0`)
- Los PDF ya generados en `SALIDAS`: si la app corrió como vos, son tuyos.
  Si son de prueba, borralos.

**El proyecto y la carpeta `SALIDAS` no se tocan**: ya son de `grado.fi`.

Como `grado.fi`: aceptar las transferencias si llega el pedido por mail (dentro
del mismo dominio a veces son inmediatas) y verificar en Detalles → Propietario
que los dos digan `grado.fi`. Transferir no cambia el ID: `CONFIG` queda igual.

**3. Autorizar y redeployar, como `grado.fi`.** Esto es lo que hace que la app
deje de correr con tu cuenta. Transferir los archivos **no** alcanza.

- Abrir el proyecto y correr `probarAccesos()`. Salta la pantalla de permisos de
  Google: eso es lo que le da a `grado.fi` su propia autorización. Las seis
  líneas tienen que dar OK, y `usuario efectivo` tiene que decir `grado.fi`. Si
  falla `Drive avanzado`: Servicios → + → Drive API v3 → Agregar.
- Implementar → Administrar implementaciones → (lápiz) → Versión: **Nueva
  versión** → Implementar. Sobre el que ya existe, **no** "Nueva
  implementación": eso crea otra URL.
- Verificar ahí mismo que **"Ejecutar como"** diga `grado.fi@ucc.edu.ar`. Si dice
  otra cosa, no quedó.
- Archivar el deployment `@HEAD` (`AKfycbxVT3Rq...`), que no se usa.

**4. Probar, desde tu notebook con tu cuenta de alumno.** No desde `grado.fi`:
el caso real es un alumno usando una app que corre como la Secretaría. Subir la
ficha, generar la nota, y confirmar que el PDF quedó con `grado.fi` como
propietaria.

**5. Dejar el zip del repo y `CLAUDE.md` en la carpeta del proyecto.** Aunque
el repo está en GitHub (`agusdimarioUCC/work-and-travel`), es de tu cuenta
personal: que la Secretaría tenga su propia copia.

**6. Desconectarte.** Solo si el paso 4 salió bien.

- Que `grado.fi` te saque el acceso.
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
