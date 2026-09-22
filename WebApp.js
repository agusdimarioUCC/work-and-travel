/**
 * NOTA INSTITUCIONAL - Interfaz web
 *
 * Archivo aparte de Codigo. Solo expone la web app y el endpoint de subida;
 * toda la lógica vive en Codigo.
 */

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Constancia de Alumno Regular - Work and Travel')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

const MIME_POR_EXT_CONSENTIMIENTO = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' };

/** Subcarpeta "Consentimientos" dentro de SALIDAS. Se crea sola la primera vez. */
function carpetaConsentimientos(carpetaSalida) {
  const existente = carpetaSalida.getFoldersByName('Consentimientos');
  return existente.hasNext() ? existente.next() : carpetaSalida.createFolder('Consentimientos');
}

/**
 * Recibe la ficha y el consentimiento firmado en base64, genera la nota y
 * devuelve el link al PDF.
 *
 * La ficha subida se borra apenas se procesa (no guardamos documentos
 * personales más de lo necesario), pero el consentimiento SE CONSERVA en
 * SALIDAS/Consentimientos: es la prueba de que el alumno aceptó. Si la
 * generación de la nota falla, el consentimiento no se guarda.
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
    carpetaConsentimientos(carpetaSalida).createFile(blobConsentimiento);

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