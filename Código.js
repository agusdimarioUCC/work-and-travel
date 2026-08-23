/**
 * NOTA INSTITUCIONAL - Work and Travel
 * Facultad de Ingeniería, UCC
 *
 * Flujo: se sube el PDF de la FICHA DEL ALUMNO -> se extraen los datos ->
 * se cruzan contra las hojas Planes y Calendario -> sale la nota en PDF.
 *
 * Las funciones de la sección LÓGICA son puras (no tocan servicios de Google):
 * se testean solas y se traducen a cualquier lenguaje sin reescribirlas.
 */

// ============================================================
// CONFIG
// ============================================================

const CONFIG = {
  ID_PLANILLA: '1W0EyQSpzkPm9oFQaB7bM7mY9PBFeElqTN5kFbXlMNrc',   // hojas "Planes" y "Calendario"
  ID_PLANTILLA: '1bHVdGrIONdfZ_FMpG4jCDdOqWYZVr6eT7TOg06vW9E8',
  ID_CARPETA_SALIDA: '1yLaQuStXytSJFLt4JKD6vyW19Yc_2GZi',
  INSTITUCION: 'Universidad Católica de Córdoba - Facultad de Ingeniería',
  MODALIDAD: 'Presencial',
  ZONA_HORARIA: 'America/Argentina/Cordoba'
};


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
    nombreFicha: alumno[2].trim(),            // "DI MARIO, AGUSTÍN"
    nombre: formatearNombre(alumno[2]),       // "Agustín Di Mario"
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

/** "DI MARIO, AGUSTÍN" -> "Agustín Di Mario" */
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

/** Los dos primeros dígitos del ID de alumno son la cohorte: 2400520 -> 2024 */
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


// ============================================================
// DATOS (Sheets)
// ============================================================

function leerPlan(clave) {
  const hoja = SpreadsheetApp.openById(CONFIG.ID_PLANILLA).getSheetByName('Planes');
  if (!hoja) throw new Error('No existe la hoja "Planes" en la planilla.');

  const filas = hoja.getDataRange().getValues();
  const cab = filas[0].map(String);
  const col = n => cab.indexOf(n);

  for (let i = 1; i < filas.length; i++) {
    if (String(filas[i][col('clave')]).trim() === clave) {
      return {
        clave: clave,
        carrera: String(filas[i][col('carrera')]).trim(),
        duracion: Number(filas[i][col('duracion_anios')]),
        materias: Number(filas[i][col('cantidad_materias')])
      };
    }
  }
  throw new Error('No hay plan cargado para la clave ' + clave +
    '. Agregá la fila en la hoja Planes antes de generar esta nota.');
}

function leerCalendario(anio) {
  const hoja = SpreadsheetApp.openById(CONFIG.ID_PLANILLA).getSheetByName('Calendario');
  if (!hoja) throw new Error('No existe la hoja "Calendario" en la planilla.');

  const filas = hoja.getDataRange().getValues();
  for (let i = 1; i < filas.length; i++) {
    if (Number(filas[i][0]) === Number(anio)) {
      return {
        anio: anio,
        finClases: formatearFecha(filas[i][1]),
        inicioClasesSig: formatearFecha(filas[i][2])
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


// ============================================================
// PDF -> TEXTO (Drive)
// ============================================================

/** Convierte el PDF a Doc temporal, extrae el texto y borra el temporal. */
function pdfATexto(idArchivoPdf) {
  const blob = DriveApp.getFileById(idArchivoPdf).getBlob();
  let docId;

  if (typeof Drive.Files.create === 'function') {          // Drive API v3
    docId = Drive.Files.create(
      { name: 'tmp-ficha-' + Date.now(), mimeType: MimeType.GOOGLE_DOCS },
      blob
    ).id;
  } else {                                                 // Drive API v2
    docId = Drive.Files.insert(
      { title: 'tmp-ficha-' + Date.now() },
      blob,
      { convert: true }
    ).id;
  }

  try {
    return DocumentApp.openById(docId).getBody().getText();
  } finally {
    DriveApp.getFileById(docId).setTrashed(true);
  }
}


// ============================================================
// GENERACIÓN DE LA NOTA (Docs -> PDF)
// ============================================================

/**
 * Copia la plantilla, reemplaza los {{PLACEHOLDERS}} y devuelve el PDF.
 * En la plantilla los campos van así: {{NOMBRE}}, {{DNI}}, {{CARRERA}}, etc.
 */
function generarNota(datos) {
  const nombreArchivo = 'Nota Institucional - ' + datos.NOMBRE + ' - ' + datos.DNI;
  const carpeta = DriveApp.getFolderById(CONFIG.ID_CARPETA_SALIDA);

  const copia = DriveApp.getFileById(CONFIG.ID_PLANTILLA).makeCopy(nombreArchivo, carpeta);
  const doc = DocumentApp.openById(copia.getId());

  const claves = Object.keys(datos).filter(k => k.charAt(0) !== '_');
  const reemplazar = seccion => {
    if (!seccion) return;
    claves.forEach(k => seccion.replaceText('\\{\\{' + k + '\\}\\}', datos[k]));
  };

  reemplazar(doc.getBody());
  reemplazar(doc.getHeader());
  reemplazar(doc.getFooter());

  doc.saveAndClose();

  // Se vuelve a pedir el archivo por ID para que el export vea los cambios ya guardados.
  const pdfBlob = DriveApp.getFileById(copia.getId()).getAs('application/pdf');
  const pdf = carpeta.createFile(pdfBlob).setName(nombreArchivo + '.pdf');

  copia.setTrashed(true);                                  // queda solo el PDF
  return pdf;
}


// ============================================================
// ORQUESTACIÓN
// ============================================================

/**
 * Recibe el ID del PDF de la ficha y devuelve todo lo necesario para
 * mostrar y generar la nota. No genera el PDF todavía.
 */
function procesarFicha(idArchivoPdf) {
  const texto = pdfATexto(idArchivoPdf);
  const ficha = extraerFicha(texto);
  const plan = leerPlan(ficha.clave);
  const calendario = leerCalendario(new Date().getFullYear());
  const datos = armarDatosNota(ficha, plan, calendario);

  return { ficha: ficha, plan: plan, datos: datos, avisos: datos._avisos };
}

/** Genera el PDF a partir de los datos ya resueltos. */
function aprobarYGenerar(datos) {
  const pdf = generarNota(datos);
  return { id: pdf.getId(), url: pdf.getUrl(), nombre: pdf.getName() };
}

/** Todo de una: ficha adentro, PDF afuera. */
function fichaANota(idArchivoPdf) {
  const r = procesarFicha(idArchivoPdf);
  const pdf = aprobarYGenerar(r.datos);
  return { pdf: pdf, datos: r.datos, avisos: r.avisos };
}


// ============================================================
// PRUEBAS
// ============================================================

const ID_FICHA_PRUEBA = '1hjFHyLCJP5Mavu8-CoLVpzEZO6XTSO-v';

/** 1) Lógica pura. No toca Drive ni Sheets, corre al instante. */
function probarLogica() {
  const muestra =
    'FICHA DEL ALUMNO (NO Válido como Documento)\n' +
    'ALUMNO: 2400520 DI MARIO, AGUSTÍN LEG: 85601 DOC: DNI 41681892 ' +
    'CARRERA: 17 INGENIERÍA EN INFORMÁTICA (PLAN: 2023)\n' +
    'Emitido: 21-08-2026\n' +
    '2024 2025 2026 2024 2025\n' +
    '2024 23-11-2023 CURSA\n';

  const ficha = extraerFicha(muestra);

  const ok = ficha.nombre === 'Agustín Di Mario'
    && ficha.nroDoc === '41681892'
    && ficha.legajo === '85601'
    && ficha.clave === '17-2023'
    && ficha.ingreso.valor === 2024
    && ficha.ingreso.confiable === true
    && ficha.ingreso.difiereDeTabla === false
    && calcularAnioQueCursa(2024, 5, 2026) === 3
    && calcularAnioQueCursa(2018, 5, 2026) === 5;   // topeado por la duración

  Logger.log(ok ? 'OK' : 'FALLA:\n' + JSON.stringify(ficha, null, 2));
}

/** 2) Extracción sobre una ficha real, sin generar nada. */
function probarExtraccion() {
  const ficha = extraerFicha(pdfATexto(ID_FICHA_PRUEBA));
  Logger.log(JSON.stringify(ficha, null, 2));
  Logger.log('ingreso -> por tabla: %s | por ID: %s | coinciden: %s',
    ficha.ingreso.porTabla, ficha.ingreso.porId, ficha.ingreso.confiable);
}

/** 3) De punta a punta: genera el PDF. */
function probarCompleto() {
  const r = fichaANota(ID_FICHA_PRUEBA);

  Logger.log('--- DATOS ---');
  Logger.log(JSON.stringify(r.datos, null, 2));

  if (r.avisos.length) {
    Logger.log('--- AVISOS ---');
    r.avisos.forEach(a => Logger.log(a));
  } else {
    Logger.log('--- SIN AVISOS ---');
  }

  Logger.log('PDF: %s', r.pdf.url);
}