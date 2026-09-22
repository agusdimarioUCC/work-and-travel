/**
 * NOTA INSTITUCIONAL - Work and Travel
 * Facultad de Ingeniería, UCC
 *
 * Flujo: se sube el PDF de la FICHA DEL ALUMNO -> se extraen los datos ->
 * se cruzan contra las hojas Planes y Calendario -> sale la nota en PDF.
 *
 * Las funciones de Logica.js son puras (no tocan servicios de Google):
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
