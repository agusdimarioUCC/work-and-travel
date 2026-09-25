/**
 * NOTA INSTITUCIONAL - Interfaz web
 *
 * Solo expone la web app y el endpoint de subida; los casos de uso viven en
 * Orquestacion.js.
 */

function doGet() {
  const pagina = HtmlService.createTemplateFromFile('Index');
  // Link de exportación a PDF: el alumno baja el archivo directo, sin pasar por
  // el Doc. Para que ande, el Doc tiene que dejar descargar a los lectores.
  pagina.urlConsentimiento =
    'https://docs.google.com/document/d/' + CONFIG.ID_CONSENTIMIENTO + '/export?format=pdf';
  return pagina.evaluate()
    .setTitle('Constancia de Alumno Regular - Work and Travel')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

const MIME_POR_EXT_CONSENTIMIENTO = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' };

const NOMBRE_REGISTRO = 'Registro de consentimientos';
const ENCABEZADOS_REGISTRO = ['Fecha y hora', 'Alumno/a', 'Legajo', 'Carrera', 'Mail', 'Consentimiento', 'Constancia'];

/** Subcarpeta "Consentimientos" dentro de SALIDAS. Se crea sola la primera vez. */
function carpetaConsentimientos(carpetaSalida) {
  const existente = carpetaSalida.getFoldersByName('Consentimientos');
  return existente.hasNext() ? existente.next() : carpetaSalida.createFolder('Consentimientos');
}

/**
 * Planilla "Registro de consentimientos" dentro de SALIDAS: el panel de la
 * Secretaría para ver quién ya subió el consentimiento. Se crea sola la
 * primera vez, igual que la subcarpeta Consentimientos.
 */
function hojaRegistro(carpetaSalida) {
  // DriveApp también devuelve los archivos en la papelera: se filtran.
  const existente = carpetaSalida.searchFiles(
    'title = "' + NOMBRE_REGISTRO + '" and trashed = false and mimeType = "' + MimeType.GOOGLE_SHEETS + '"'
  );
  if (existente.hasNext()) return SpreadsheetApp.open(existente.next()).getSheets()[0];

  const planilla = SpreadsheetApp.create(NOMBRE_REGISTRO);
  DriveApp.getFileById(planilla.getId()).moveTo(carpetaSalida);
  planilla.setSpreadsheetTimeZone(CONFIG.ZONA_HORARIA);

  const hoja = planilla.getSheets()[0];
  hoja.appendRow(ENCABEZADOS_REGISTRO);
  hoja.getRange(1, 1, 1, ENCABEZADOS_REGISTRO.length).setFontWeight('bold');
  hoja.setFrozenRows(1);
  hoja.getRange('A:A').setNumberFormat('dd/MM/yyyy HH:mm');
  return hoja;
}

/** Suma una fila al registro. Sheets muestra los links como clickeables. */
function registrarEnvio(carpetaSalida, r, consentimiento) {
  hojaRegistro(carpetaSalida).appendRow([
    new Date(),
    r.datos.NOMBRE,
    r.datos.LEGAJO,
    r.datos.CARRERA,
    Session.getActiveUser().getEmail(),
    consentimiento.getUrl(),
    r.pdf.url
  ]);
}

/**
 * Recibe la ficha y el consentimiento firmado en base64, genera la nota y
 * devuelve el link al PDF.
 *
 * La ficha subida se borra apenas se procesa (no guardamos documentos
 * personales más de lo necesario), pero el consentimiento SE CONSERVA en
 * SALIDAS/Consentimientos: es la prueba de que el alumno aceptó. Cada envío
 * queda anotado en la planilla "Registro de consentimientos". Si la
 * generación de la nota falla, no se guarda ni se registra nada.
 */
function subirYGenerar(nombreFicha, base64Ficha, nombreConsentimiento, base64Consentimiento) {
  let idFicha = null;

  try {
    if (!base64Ficha) throw new Error('No llegó ningún archivo de ficha.');
    if ((nombreFicha || '').split('.').pop().toLowerCase() !== 'pdf') {
      throw new Error('El archivo tiene que ser el PDF de la ficha del alumno.');
    }
    if (!base64Consentimiento) throw new Error('Falta subir el consentimiento firmado.');
    const ext = (nombreConsentimiento || '').split('.').pop().toLowerCase();
    if (!MIME_POR_EXT_CONSENTIMIENTO[ext]) {
      throw new Error('El consentimiento tiene que ser un PDF o una imagen (jpg/png).');
    }

    const blobFicha = Utilities.newBlob(
      Utilities.base64Decode(base64Ficha), 'application/pdf', nombreFicha
    );

    const carpetaSalida = DriveApp.getFolderById(CONFIG.ID_CARPETA_SALIDA);
    idFicha = carpetaSalida.createFile(blobFicha).getId();

    const r = fichaANota(idFicha);

    const blobConsentimiento = Utilities.newBlob(
      Utilities.base64Decode(base64Consentimiento),
      MIME_POR_EXT_CONSENTIMIENTO[ext],
      'Consentimiento - ' + r.datos.NOMBRE + ' - ' + r.datos.DNI + '.' + ext
    );
    const consentimiento = carpetaConsentimientos(carpetaSalida).createFile(blobConsentimiento);
    registrarEnvio(carpetaSalida, r, consentimiento);

    return {
      ok: true,
      url: r.pdf.url,
      nombre: r.pdf.nombre,
      alumno: r.datos.NOMBRE,
      carrera: r.datos.CARRERA,
      anioCursa: r.datos.ANIO_CURSA,
      avisos: r.avisos
    };

  } catch (e) {
    return { ok: false, error: String(e.message || e) };

  } finally {
    if (idFicha) {
      try { DriveApp.getFileById(idFicha).setTrashed(true); } catch (ignorar) {}
    }
  }
}