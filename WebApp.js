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

/**
 * Recibe la ficha en base64, genera la nota y devuelve el link al PDF.
 * La ficha subida se borra apenas se procesa: no guardamos documentos
 * personales más de lo necesario.
 */
function subirYGenerar(nombreArchivo, base64) {
  let idFicha = null;

  try {
    if (!base64) throw new Error('No llegó ningún archivo.');
    if (!/\.pdf$/i.test(nombreArchivo || '')) {
      throw new Error('El archivo tiene que ser el PDF de la ficha del alumno.');
    }

    const blob = Utilities.newBlob(
      Utilities.base64Decode(base64), 'application/pdf', nombreArchivo
    );

    const carpeta = DriveApp.getFolderById(CONFIG.ID_CARPETA_SALIDA);
    idFicha = carpeta.createFile(blob).getId();

    const r = fichaANota(idFicha);

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