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
