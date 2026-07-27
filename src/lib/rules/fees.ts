/**
 * Extensión de RN-3 (blueprint Sección 7) — sesiones → costo. Tomado de las fórmulas
 * reales de `field_scripts.json` de Forms 1-7 página 7 ("SERVICE FEE AND FINANCIAL
 * RESPONSIBILITY", campos RE0011/OP0011/EI0011/CCP0009/TC0002):
 *
 *   costo_programa = sesiones_programa × cuota_por_sesión   (AFSimple_Calculate "PRD")
 *   costo_total    = suma de costo_programa de cada programa aplicable  ("SUM")
 *
 * La cuota por sesión NO es una constante del sistema — en el PDF real es un campo de
 * texto editable con un valor por defecto ($50.00 para RE/OP/EI, $50.00 por sesión de
 * CCP, $25.00 para reabrir un caso cerrado por abandono). Un consejero puede escribir
 * una cuota distinta caso por caso (ej. escala variable). Por eso estas funciones
 * reciben la cuota como parámetro — los defaults solo existen para prellenar el
 * formulario, nunca se usan implícitamente en el cálculo.
 *
 * Los montos se manejan en centavos (mismo patrón que `case_balances`/ledger, RN-5) —
 * nunca floats de dólares, para no arrastrar errores de redondeo.
 */

/** Valores por defecto tal como están hoy en Forms_1-7 R12 (campos RE0008/OP0008/
 *  EI0008/CCP0006/SP002) — prellenan el formulario, el consejero los puede cambiar. */
export const DEFAULT_FEE_PER_SESSION_CENTS = 5000; // $50.00
export const DEFAULT_REOPEN_FEE_CENTS = 2500; // $25.00

/** costo_programa = sesiones × cuota_por_sesión (RE0011/OP0011/EI0011/CCP0009). */
export function programFeeCents(sessions: number, feePerSessionCents: number): number {
  return Math.round(sessions * feePerSessionCents);
}

/** costo_total = SUM de los costos de cada programa aplicable (TC0002). Los
 *  programas que no aplican a este caso (RN-2) simplemente no entran al arreglo —
 *  no hace falta "apagarlos", a diferencia del PDF que los oculta con display=hidden. */
export function totalFeeCents(programFeesCents: number[]): number {
  return programFeesCents.reduce((sum, fee) => sum + fee, 0);
}
