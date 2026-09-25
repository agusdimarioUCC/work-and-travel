// ============================================================
// MANTENIMIENTO
// ============================================================

/**
 * Protege la planilla contra errores de carga. Se corre a mano desde el editor,
 * y se puede volver a correr las veces que haga falta (rehace todo):
 *
 *   - Encabezados de Planes y Calendario protegidos con advertencia. El código
 *     busca las columnas por esos nombres; si alguien los cambia, la app frena.
 *   - Validación por columna: rechaza lo que no sea un valor válido.
 *   - La columna clave en formato texto, para que Sheets no convierta
 *     "03-2023" en una fecha.
 *
 * Sheets no borra lo que ya estaba cargado y no cumple la validación: solo lo
 * marca. Por eso al final loguea esas celdas, para corregirlas a mano.
 */
function blindarPlanilla() {
  const planilla = SpreadsheetApp.openById(CONFIG.ID_PLANILLA);
  const DESCRIPCION = 'Encabezados: el código busca las columnas por estos nombres';
  const letra = i => String.fromCharCode(65 + i);
  const columna = (hoja, i) => hoja.getRange(2, i + 1, hoja.getMaxRows() - 1, 1);
  const validar = (hoja, i, formula, ayuda) => columna(hoja, i).setDataValidation(
    SpreadsheetApp.newDataValidation().requireFormulaSatisfied(formula)
      .setAllowInvalid(false).setHelpText(ayuda).build());
  // Condiciones (sin el =AND) de "entero entre min y max" para la celda de la fila 2.
  // Separadas por ";": la planilla está en locale es_ES, donde "," no separa
  // argumentos de fórmula (es el separador decimal). Con "," Sheets rechaza
  // la regla entera, incluso una tan trivial como =AND(TRUE,TRUE).
  const entero = (i, min, max) => {
    const c = letra(i) + '2';
    return 'ISNUMBER(' + c + ');' + c + '=INT(' + c + ');' +
      c + '>=' + min + ';' + c + '<=' + max;
  };
  const protegerEncabezados = hoja => {
    hoja.getProtections(SpreadsheetApp.ProtectionType.RANGE)
      .filter(p => p.getDescription() === DESCRIPCION)
      .forEach(p => p.remove());
    hoja.getRange(1, 1, 1, hoja.getLastColumn()).protect()
      .setDescription(DESCRIPCION).setWarningOnly(true);
  };
  const problemas = [];

  // --- Planes
  const planes = planilla.getSheetByName('Planes');
  const filasP = planes.getDataRange().getValues();
  const p = ubicarColumnas(filasP[0],
    ['clave', 'carrera', 'duracion_anios', 'cantidad_materias'], 'Planes');
  const k = letra(p.clave);

  protegerEncabezados(planes);
  columna(planes, p.clave).setNumberFormat('@');
  validar(planes, p.clave,
    '=AND(REGEXMATCH(TO_TEXT(' + k + '2);"^\\d{2}-\\d{4}$");' +
    'COUNTIF($' + k + '$2:$' + k + ';' + k + '2)=1)',
    'Código de carrera y plan, ej: 17-2023. No puede repetirse.');
  validar(planes, p.duracion_anios, '=AND(' + entero(p.duracion_anios, 1, 10) + ')',
    'Duración en años: número entero entre 1 y 10.');
  validar(planes, p.cantidad_materias, '=AND(' + entero(p.cantidad_materias, 1, 150) + ')',
    'Cantidad de materias: número entero entre 1 y 150.');

  const vistas = {};
  for (let i = 1; i < filasP.length; i++) {
    const clave = String(filasP[i][p.clave]).trim();
    if (!clave) continue;
    if (!/^\d{2}-\d{4}$/.test(clave)) {
      problemas.push('Planes, fila ' + (i + 1) + ': la clave "' + clave + '" no tiene ' +
        'el formato 17-2023. Si Sheets la convirtió en fecha, volvé a escribirla.');
    }
    if (vistas[clave]) problemas.push('Planes, fila ' + (i + 1) + ': la clave ' + clave +
      ' está repetida (también en la fila ' + vistas[clave] + ').');
    vistas[clave] = i + 1;
    try {
      validarPlan({
        clave: clave,
        carrera: String(filasP[i][p.carrera]).trim(),
        duracion: Number(filasP[i][p.duracion_anios]),
        materias: Number(filasP[i][p.cantidad_materias])
      });
    } catch (e) {
      problemas.push('Planes, fila ' + (i + 1) + ': ' + e.message);
    }
  }

  // --- Calendario
  const calendario = planilla.getSheetByName('Calendario');
  const filasC = calendario.getDataRange().getValues();
  const c = ubicarColumnas(filasC[0],
    ['anio', 'fin_clases', 'inicio_clases_siguiente'], 'Calendario');
  const a = letra(c.anio);

  protegerEncabezados(calendario);
  validar(calendario, c.anio,
    '=AND(' + entero(c.anio, 2020, 2100) + ';' +
    'COUNTIF($' + a + '$2:$' + a + ';' + a + '2)=1)',
    'Año: número entero, una sola fila por año.');
  ['fin_clases', 'inicio_clases_siguiente'].forEach(n => columna(calendario, c[n])
    .setDataValidation(SpreadsheetApp.newDataValidation().requireDate()
      .setAllowInvalid(false).setHelpText('Fecha, ej: 13/11/2026.').build()));

  for (let i = 1; i < filasC.length; i++) {
    if (filasC[i][c.anio] === '') continue;
    ['fin_clases', 'inicio_clases_siguiente'].forEach(n => {
      const v = filasC[i][c[n]];
      if (v !== '' && !(v instanceof Date)) {
        problemas.push('Calendario, fila ' + (i + 1) + ': ' + n + ' ("' + v + '") está ' +
          'cargada como texto, no como fecha. Volvé a escribirla.');
      }
    });
  }

  Logger.log(problemas.length
    ? 'Planilla blindada, pero hay celdas ya cargadas que corregir:\n- ' + problemas.join('\n- ')
    : 'Planilla blindada. Todo lo cargado cumple la validación.');
}
