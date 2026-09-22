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
  ID_PLANILLA: '1U0IEygsMU0hsesUHbmhNiMD6fSwaPE4fS7lqmaBPJ04',   // hojas "Planes" y "Calendario" (Google Sheets nativo)
  ID_PLANTILLA: '1jhI-qM0_Yd1HdbCA9W0QlbYjbX4Llap8-Q-SA3hgbb0',   // plantilla de la nota (Google Docs nativo)
  ID_CARPETA_SALIDA: '1xYDMz4UdAeQWr8X7Opaqg8Ey3Skf3mI5',
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
  // La web app corre como el usuario del deployment, no como el alumno, y el PDF
  // nace con los permisos de la carpeta SALIDAS. Le damos acceso de lectura SOLO
  // al alumno que generó esta constancia: así puede abrir el link que le
  // devolvemos y ningún alumno ve la ficha de otro.
  // Se chequea antes de crear nada: si falla, no queda ningún archivo con DNI.
  const alumno = Session.getActiveUser().getEmail();
  if (!alumno) {
    throw new Error(
      'No se pudo identificar tu cuenta, así que no se puede compartirte la ' +
      'constancia. Entrá con tu cuenta @ucc.edu.ar y volvé a intentar. Si sigue ' +
      'pasando, avisale a la Secretaría de Grado.'
    );
  }

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
  pdf.addViewer(alumno);

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

// ============================================================
// PRUEBAS
// ============================================================

/**
 * ID de un PDF de ficha para las pruebas que tocan Drive (probarExtraccion y
 * probarCompleto). Va vacío a propósito: una ficha real trae DNI y domicilio,
 * y no corresponde dejar la de nadie fija en el código.
 *
 * Para usar esas dos pruebas: subir una ficha a Drive, pegar acá su ID, correr
 * la prueba y volver a vaciar la constante. probarLogica() y probarAccesos()
 * no la necesitan.
 */
const ID_FICHA_PRUEBA = '';

/** 1) Lógica pura. No toca Drive ni Sheets, corre al instante. */
function probarLogica() {
  // Datos inventados: esta prueba no usa la ficha de ningún alumno real.
  const muestra =
    'FICHA DEL ALUMNO (NO Válido como Documento)\n' +
    'ALUMNO: 2400000 PÉREZ, JUAN MARTÍN LEG: 99999 DOC: DNI 40000000 ' +
    'CARRERA: 17 INGENIERÍA EN INFORMÁTICA (PLAN: 2023)\n' +
    'Emitido: 21-08-2026\n' +
    '2024 2025 2026 2024 2025\n' +
    '2024 23-11-2023 CURSA\n';

  const ficha = extraerFicha(muestra);

  const ok = ficha.nombre === 'Juan Martín Pérez'
    && ficha.nroDoc === '40000000'
    && ficha.legajo === '99999'
    && ficha.clave === '17-2023'
    && ficha.ingreso.valor === 2024
    && ficha.ingreso.confiable === true
    && ficha.ingreso.difiereDeTabla === false
    && calcularAnioQueCursa(2024, 5, 2026) === 3
    && calcularAnioQueCursa(2018, 5, 2026) === 5;   // topeado por la duración

  // Planilla: columnas por nombre, y filas mal cargadas que tienen que frenar.
  const tira = f => { try { f(); return false; } catch (e) { return true; } };
  const planOk = { clave: '17-2023', carrera: 'Ingeniería', duracion: 5, materias: 62 };
  const okPlanilla =
       ubicarColumnas(['anio', ' fin_clases ', 'x'], ['fin_clases', 'anio'], 'C').fin_clases === 1
    && tira(() => ubicarColumnas(['clave', 'carrera'], ['clave', 'duracion_anios'], 'Planes'))
    && validarPlan(planOk) === planOk
    && tira(() => validarPlan(Object.assign({}, planOk, { duracion: NaN })))    // texto en la celda
    && tira(() => validarPlan(Object.assign({}, planOk, { materias: 0 })))      // celda vacía
    && tira(() => validarPlan(Object.assign({}, planOk, { materias: 62.5 })))
    && tira(() => validarPlan(Object.assign({}, planOk, { carrera: '' })));

  Logger.log(ok && okPlanilla ? 'OK' :
    'FALLA' + (okPlanilla ? '' : ' (validación de la planilla)') + ':\n' +
    JSON.stringify(ficha, null, 2));
}

/** Corta con un mensaje claro si no se cargó una ficha para probar. */
function idFichaDePrueba() {
  if (!ID_FICHA_PRUEBA) {
    throw new Error(
      'Falta el ID de la ficha de prueba. Subí un PDF de ficha a Drive, pegá ' +
      'su ID en ID_FICHA_PRUEBA (sección PRUEBAS) y volvé a correr. Acordate ' +
      'de vaciarlo después: la ficha trae datos personales del alumno.'
    );
  }
  return ID_FICHA_PRUEBA;
}

/** 2) Extracción sobre una ficha real, sin generar nada. */
function probarExtraccion() {
  const ficha = extraerFicha(pdfATexto(idFichaDePrueba()));
  Logger.log(JSON.stringify(ficha, null, 2));
  Logger.log('ingreso -> por tabla: %s | por ID: %s | coinciden: %s',
    ficha.ingreso.porTabla, ficha.ingreso.porId, ficha.ingreso.confiable);
}

/**
 * 0) Diagnóstico de accesos. Corré esta primero cuando algo falla con
 * "Acceso denegado" o "no se encontró el archivo".
 *
 * Toca los tres recursos de CONFIG por separado para saber cuál falla, en vez
 * de que el primer error tape a los otros dos. No lee ninguna ficha, así que
 * se puede correr sin datos de ningún alumno.
 *
 * Correrla desde el editor también es la forma de disparar la pantalla de
 * permisos de Google: hasta que no se acepte, la web app tira
 * "Acceso denegado: DriveApp" aunque el sharing esté bien.
 */
function probarAccesos() {
  chequearAccesos().forEach(linea => Logger.log(linea));
}

/**
 * Chequea los recursos de CONFIG uno por uno y devuelve una línea por cada
 * uno, en vez de cortar en el primer error.
 *
 * Se usa desde el editor (probarAccesos) y desde WebApp.js cuando algo falla.
 * Correrlo en los dos lados permite comparar contextos de ejecución: el
 * editor corre con tu sesión, la web app con el token del deployment, y no
 * siempre tienen los mismos permisos.
 */
function chequearAccesos() {
  const chequeos = [
    ['carpeta de salida', () => DriveApp.getFolderById(CONFIG.ID_CARPETA_SALIDA).getName()],
    ['plantilla',         () => DriveApp.getFileById(CONFIG.ID_PLANTILLA).getName()],
    ['planilla',          () => SpreadsheetApp.openById(CONFIG.ID_PLANILLA).getName()],
    ['Drive avanzado',    () => Drive.getVersion()],
    // Quién es dueño de la carpeta y con qué rol entra la cuenta que ejecuta.
    // Es lo que explica el FALLA de abajo: sin esto hay que ir a adivinar a
    // Drive, y el mensaje "Access denied: DriveApp" no nombra ni la carpeta.
    ['acceso a la carpeta', () => {
      const carpeta = DriveApp.getFolderById(CONFIG.ID_CARPETA_SALIDA);
      let duenio = '(no visible)';
      try {
        const o = carpeta.getOwner();
        if (o) duenio = o.getEmail();
      } catch (ignorar) {}
      return 'entro como ' + carpeta.getAccess(Session.getEffectiveUser()) +
        ', dueño ' + duenio;
    }],
    // El chequeo que importa: la app CREA archivos en la carpeta de salida.
    // Con permiso de Lector los de arriba dan OK igual y este falla.
    ['escritura en carpeta', () => {
      const tmp = DriveApp.getFolderById(CONFIG.ID_CARPETA_SALIDA)
        .createFile('tmp-chequeo-permisos.txt', '');
      tmp.setTrashed(true);
      return 'se pudo crear y borrar';
    }],
    // Vacío en cuentas personales; solo devuelve el mail dentro de un Workspace.
    ['usuario efectivo',  () => Session.getEffectiveUser().getEmail() || '(vacío)']
  ];

  return chequeos.map(par => {
    try {
      return 'OK ' + par[0] + ' -> ' + par[1]();
    } catch (e) {
      return 'FALLA ' + par[0] + ' -> ' + (e.message || e);
    }
  });
}

/** 3) De punta a punta: genera el PDF. */
function probarCompleto() {
  const r = fichaANota(idFichaDePrueba());

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

/**
 * Texto de una ficha inventada, con el mismo formato que produce Oracle Reports.
 * No son los datos de ningún alumno real.
 */
const FICHA_SINTETICA = [
  'FICHA DEL ALUMNO (NO Valido como Documento)',
  'ALUMNO: 2400000 PEREZ, JUAN MARTIN LEG: 99999 DOC: DNI 40000000 ' +
    'CARRERA: 17 INGENIERIA EN INFORMATICA (PLAN: 2023)',
  'HISTORIA DE ESTA ACTIVIDAD ACADEMICA',
  '2024 2025 2026 2024 2025',
  '2024 23-11-2023 CURSA'
].join('\n');

/**
 * 4) Punta a punta sin datos de nadie y sin tocar la carpeta de salida.
 *
 * Fabrica la ficha (un Doc con el texto, exportado a PDF) y un consentimiento
 * sintético, y llama a subirYGenerar() -tal cual la web app-, dentro de una
 * carpeta temporal propia que borra al terminar.
 *
 * Redirige CONFIG.ID_CARPETA_SALIDA solo durante esta ejecución: no cambia nada
 * en el proyecto ni en la web app deployada. Sirve para verificar el flujo
 * completo cuando la carpeta de salida todavía no tiene permiso de escritura,
 * que es lo único que probarAccesos() no puede sortear.
 */
function probarPuntaAPunta() {
  const original = CONFIG.ID_CARPETA_SALIDA;
  const carpeta = DriveApp.createFolder('tmp-prueba-wat-' + Date.now());
  let idDocFicha = null;

  try {
    CONFIG.ID_CARPETA_SALIDA = carpeta.getId();

    const doc = DocumentApp.create('tmp-ficha-sintetica');
    idDocFicha = doc.getId();
    doc.getBody().setText(FICHA_SINTETICA);
    doc.saveAndClose();

    const base64Ficha = Utilities.base64Encode(
      DriveApp.getFileById(idDocFicha).getAs('application/pdf').getBytes()
    );
    const base64Consentimiento = Utilities.base64Encode(
      Utilities.newBlob('Acepto los términos.').getBytes()
    );

    const r = subirYGenerar('ficha-sintetica.pdf', base64Ficha, 'consentimiento-sintetico.pdf', base64Consentimiento);
    if (!r.ok) throw new Error(r.error);

    Logger.log('--- RESULTADO ---');
    Logger.log(JSON.stringify(r, null, 2));

    const consentimientos = DriveApp.getFolderById(carpeta.getId()).getFoldersByName('Consentimientos');
    Logger.log(consentimientos.hasNext()
      ? 'OK -> se guardó el consentimiento en SALIDAS/Consentimientos'
      : 'FALLA -> no se creó la subcarpeta Consentimientos');
    Logger.log('OK punta a punta -> se generó "%s"', r.nombre);

  } finally {
    CONFIG.ID_CARPETA_SALIDA = original;
    if (idDocFicha) {
      try { DriveApp.getFileById(idDocFicha).setTrashed(true); } catch (ignorar) {}
    }
    carpeta.setTrashed(true);          // se lleva lo de adentro
  }
}