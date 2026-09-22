// ============================================================
// LÓGICA (funciones puras)
// ============================================================

/**
 * Saca los datos del alumno del texto de la ficha.
 * Drive pega las líneas ALUMNO: y CARRERA: en una sola, así que buscamos
 * cada campo por su etiqueta en lugar de asumir el corte de línea.
 */
function extraerFicha(texto) {
  const buscar = (re, nombre) => {
    const m = texto.match(re);
    if (!m) throw new Error('No se pudo leer el campo: ' + nombre);
    return m;
  };

  const alumno = buscar(/ALUMNO:\s*(\d+)\s+(.+?)\s+LEG:\s*(\d+)/, 'ALUMNO');
  const doc    = buscar(/DOC:\s*(\S+)\s+(\d+)/, 'DOC');
  const carr   = buscar(/CARRERA:\s*(\d+)\s+(.+?)\s*\(PLAN:\s*(\d{4})\)/, 'CARRERA');

  const idAlumno = alumno[1];

  return {
    idAlumno: idAlumno,
    nombreFicha: alumno[2].trim(),            // "PÉREZ, JUAN MARTÍN"
    nombre: formatearNombre(alumno[2]),       // "Juan Martín Pérez"
    legajo: alumno[3],
    tipoDoc: doc[1],
    nroDoc: doc[2],
    codCarrera: carr[1],
    carreraFicha: carr[2].trim(),
    plan: carr[3],
    clave: carr[1] + '-' + carr[3],           // "17-2023"
    ingreso: resolverAnioIngreso(texto, idAlumno)
  };
}

/** "PÉREZ, JUAN MARTÍN" -> "Juan Martín Pérez" */
function formatearNombre(apellidoNombre) {
  const partes = apellidoNombre.split(',');
  const apellido = partes[0] || '';
  const nombre = partes[1] || '';
  const titulo = s => s.trim().toLowerCase().split(/\s+/)
    .filter(String)
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
  return (titulo(nombre) + ' ' + titulo(apellido)).trim();
}

/**
 * Año de ingreso por el mínimo de la columna "Año" de la tabla de asignaturas.
 * Drive desarma esa tabla, pero para un mínimo no hace falta que las filas
 * estén armadas. Hay que excluir dos fuentes de contaminación:
 *   - el año del plan, que puede ser anterior al ingreso
 *   - las fechas dd-mm-aaaa (inscripción, exámenes, resoluciones)
 */
function anioIngresoPorTabla(texto, anioActual) {
  const actual = anioActual || new Date().getFullYear();
  const limpio = texto
    .replace(/plan:?\s*20\d{2}/gi, ' ')
    .replace(/\b\d{2}-\d{2}-\d{4}\b/g, ' ');

  const anios = (limpio.match(/\b20\d{2}\b/g) || [])
    .map(Number)
    .filter(a => a >= 2000 && a <= actual);

  return anios.length ? Math.min.apply(null, anios) : null;
}

/** Los dos primeros dígitos del ID de alumno son la cohorte: 2400000 -> 2024 */
function anioIngresoPorId(idAlumno) {
  const n = parseInt(String(idAlumno).substring(0, 2), 10);
  return isNaN(n) ? null : 2000 + n;
}

/**
 * El ID de alumno codifica la cohorte de forma confirmada (Aaron, 2026-08),
 * así que es la fuente de verdad. La tabla de materias queda como chequeo
 * cruzado: si difiere, no es que el ID esté mal, es señal de algo puntual
 * en esa ficha (equivalencias de otra universidad, cambio de carrera) que
 * vale la pena que alguien mire.
 */
function resolverAnioIngreso(texto, idAlumno, anioActual) {
  const porTabla = anioIngresoPorTabla(texto, anioActual);
  const porId = anioIngresoPorId(idAlumno);

  return {
    valor: porId,
    confiable: porId !== null,
    difiereDeTabla: porTabla !== null && porTabla !== porId,
    porTabla: porTabla,
    porId: porId
  };
}

/** Año que cursa, topeado por la duración de la carrera. */
function calcularAnioQueCursa(anioIngreso, duracion, anioActual) {
  const actual = anioActual || new Date().getFullYear();
  return Math.max(1, Math.min(actual - anioIngreso + 1, duracion));
}

/** Junta ficha + plan + calendario en el objeto que llena la plantilla. */
function armarDatosNota(ficha, plan, calendario, anioActual) {
  const actual = anioActual || new Date().getFullYear();
  const anioCursa = calcularAnioQueCursa(ficha.ingreso.valor, plan.duracion, actual);

  const avisos = [];
  if (!ficha.ingreso.confiable) {
    avisos.push('No se pudo determinar el año de ingreso a partir del ID de alumno "' +
      ficha.idAlumno + '". Revisar manualmente.');
  } else if (ficha.ingreso.difiereDeTabla) {
    avisos.push('El año de ingreso (' + ficha.ingreso.porId + ', por ID de alumno) no ' +
      'coincide con el mínimo de la tabla de materias (' + ficha.ingreso.porTabla + '). ' +
      'Puede tratarse de equivalencias, cambio de carrera o reincorporación — vale la ' +
      'pena confirmar antes de firmar.');
  }
  if (!calendario.finClases) {
    avisos.push('Falta el calendario académico del año ' + actual + ' en la hoja Calendario.');
  }

  return {
    NOMBRE: ficha.nombre,
    DNI: ficha.nroDoc,
    LEGAJO: ficha.legajo,
    INSTITUCION: CONFIG.INSTITUCION,
    CARRERA: plan.carrera,
    TITULO: plan.carrera,
    MODALIDAD: CONFIG.MODALIDAD,
    DURACION: plan.duracion + (plan.duracion === 1 ? ' año' : ' años'),
    CANT_MATERIAS: String(plan.materias),
    ANIO_INGRESO: String(ficha.ingreso.valor),
    ANIO_ACTUAL: String(actual),
    ANIO_CURSA: String(anioCursa) + '°',
    FIN_CLASES: calendario.finClases || '',
    INICIO_CLASES_SIG: calendario.inicioClasesSig || 'A determinar',
    _avisos: avisos
  };
}

/**
 * Índice de cada columna pedida, buscada por nombre en la fila de encabezados.
 * Si falta alguna, tira error: leer por posición, o seguir con una columna que
 * no está, pone datos equivocados en la nota sin que nadie lo note.
 */
function ubicarColumnas(encabezados, nombres, hoja) {
  const cab = encabezados.map(c => String(c).trim());
  const faltan = nombres.filter(n => cab.indexOf(n) === -1);
  if (faltan.length) {
    throw new Error('En la hoja ' + hoja + ' faltan las columnas: ' + faltan.join(', ') +
      '. Revisá que la primera fila tenga esos nombres exactos.');
  }
  const indices = {};
  nombres.forEach(n => { indices[n] = cab.indexOf(n); });
  return indices;
}

/** Tira error si la fila del plan tiene algo que no sirve para la nota. */
function validarPlan(plan) {
  const enteroPositivo = n => Number.isInteger(n) && n > 0;
  const problemas = [];
  if (!plan.carrera) problemas.push('la carrera está vacía');
  if (!enteroPositivo(plan.duracion)) problemas.push('duracion_anios no es un entero positivo');
  if (!enteroPositivo(plan.materias)) problemas.push('cantidad_materias no es un entero positivo');
  if (problemas.length) {
    throw new Error('La fila ' + plan.clave + ' de la hoja Planes está mal cargada: ' +
      problemas.join(', ') + '. Corregila antes de generar esta nota.');
  }
  return plan;
}
