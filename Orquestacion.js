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
