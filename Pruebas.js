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
      'su ID en ID_FICHA_PRUEBA (Pruebas.js) y volvé a correr. Acordate ' +
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
