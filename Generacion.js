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

  // El finally borra la copia aunque algo falle: si no, queda un Doc editable con
  // el DNI en SALIDAS, y cada reintento del alumno suma otro.
  try {
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
    return pdf;
  } finally {
    copia.setTrashed(true);                                // queda solo el PDF
  }
}
