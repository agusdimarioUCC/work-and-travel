// ============================================================
// DATOS (Sheets)
// ============================================================

function leerPlan(clave) {
  const hoja = SpreadsheetApp.openById(CONFIG.ID_PLANILLA).getSheetByName('Planes');
  if (!hoja) throw new Error('No existe la hoja "Planes" en la planilla.');

  const filas = hoja.getDataRange().getValues();
  const col = ubicarColumnas(filas[0],
    ['clave', 'carrera', 'duracion_anios', 'cantidad_materias'], 'Planes');

  for (let i = 1; i < filas.length; i++) {
    if (String(filas[i][col.clave]).trim() === clave) {
      return validarPlan({
        clave: clave,
        carrera: String(filas[i][col.carrera]).trim(),
        duracion: Number(filas[i][col.duracion_anios]),
        materias: Number(filas[i][col.cantidad_materias])
      });
    }
  }
  throw new Error('No hay plan cargado para la clave ' + clave +
    '. Agregá la fila en la hoja Planes antes de generar esta nota.');
}

function leerCalendario(anio) {
  const hoja = SpreadsheetApp.openById(CONFIG.ID_PLANILLA).getSheetByName('Calendario');
  if (!hoja) throw new Error('No existe la hoja "Calendario" en la planilla.');

  const filas = hoja.getDataRange().getValues();
  const col = ubicarColumnas(filas[0],
    ['anio', 'fin_clases', 'inicio_clases_siguiente'], 'Calendario');

  for (let i = 1; i < filas.length; i++) {
    if (Number(filas[i][col.anio]) === Number(anio)) {
      return {
        anio: anio,
        finClases: formatearFecha(filas[i][col.fin_clases]),
        inicioClasesSig: formatearFecha(filas[i][col.inicio_clases_siguiente])
      };
    }
  }
  return { anio: anio, finClases: '', inicioClasesSig: 'A determinar' };
}

function formatearFecha(v) {
  if (!v) return '';
  if (v instanceof Date) return Utilities.formatDate(v, CONFIG.ZONA_HORARIA, 'dd/MM/yyyy');
  return String(v).trim();
}
