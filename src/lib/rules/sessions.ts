/**
 * RN-3 (blueprint Sección 7) — horas → número de sesiones.
 *
 * sesiones_RE = horas_RE / 2
 * sesiones_EI = horas_EI / 2
 * sesiones_OP = horas_OP / 3  si horas_OP >= 50
 *             = horas_OP / 2  si horas_OP <  50
 *
 * El bug que esto reemplaza: el PDF original comparaba el umbral de 50 como TEXTO,
 * no como número. En una comparación de string, "7" >= "50" es VERDADERO (el
 * carácter '7' es mayor que '5' en orden lexicográfico) — así que un paciente con
 * apenas 7 horas de Outpatient caía por error en la división entre 3 en vez de
 * entre 2, subestimando sus sesiones requeridas. Aquí la comparación es siempre
 * numérica — el test `sessions.test.ts` incluye ese caso exacto como regresión.
 *
 * Las cifras no se redondean aquí: quien llama decide si necesita Math.ceil()
 * (sesiones no pueden ser fraccionarias en la agenda real) — mantener la función
 * pura y sin opinión sobre redondeo facilita probarla contra los números exactos
 * del blueprint (75h → 25, 20h → 10, 10h → 5).
 */

export function sessionsForRiskEducation(hours: number): number {
  return hours / 2;
}

export function sessionsForEarlyIntervention(hours: number): number {
  return hours / 2;
}

export function sessionsForOutpatient(hours: number): number {
  // Comparación NUMÉRICA explícita — es el punto exacto del bug corregido.
  return hours >= 50 ? hours / 3 : hours / 2;
}
