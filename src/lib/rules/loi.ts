/**
 * RN-2 (blueprint Sección 7, "Reglas de negocio") — LOI → programas.
 *
 * Minimal Risk → [RE]; Moderate Risk → [RE, EI]; Significant Risk → [RE, OP, CCP];
 * High Risk → [OP, CCP]; Risk Education → [RE]; Early Intervention → [EI];
 * Outpatient → [OP, CCP]; Intensive Outpatient → [OP, CCP].
 *
 * "Intensive Outpatient" aparece en el catálogo de `cases.loi` (dropdown del
 * formulario de Admisión) pero no en el dropdown de Forms 1-7, y RN-2 no
 * especificaba su mapeo de forma explícita — se dejó sin resolver a propósito en vez
 * de adivinar. RESUELTO por Jorge (documento "Preguntas para Jorge — Treatment Tech",
 * pregunta 2, respondido 2026-07-26): "75 horas de tratamiento + Continuing Care" —
 * es decir, mismo combo de programas que "Outpatient" ([OP, CCP]), con las horas en
 * el extremo superior del rango de OP (20-75, ver HOURS_RANGE). No se modela un rango
 * de horas distinto para Intensive Outpatient porque Jorge no describió uno — usa el
 * mismo HOURS_RANGE.OP existente; si en la curación de Forms 1-7/Admissions aparece
 * un piso de horas específico para este caso, ajustar ahí, no aquí.
 */

export type ProgramBlock = "RE" | "EI" | "OP" | "CCP";

export type LOI =
  | "Minimal Risk"
  | "Moderate Risk"
  | "Significant Risk"
  | "High Risk"
  | "Risk Education"
  | "Early Intervention"
  | "Outpatient"
  | "Intensive Outpatient";

const LOI_TO_PROGRAMS: Record<LOI, ProgramBlock[]> = {
  "Minimal Risk": ["RE"],
  "Moderate Risk": ["RE", "EI"],
  "Significant Risk": ["RE", "OP", "CCP"],
  "High Risk": ["OP", "CCP"],
  "Risk Education": ["RE"],
  "Early Intervention": ["EI"],
  Outpatient: ["OP", "CCP"],
  "Intensive Outpatient": ["OP", "CCP"],
};

export class UnresolvedLOIError extends Error {
  constructor(loi: string) {
    super(
      `LOI "${loi}" no tiene mapeo de programas resuelto en RN-2. No se asume — ` +
        `confirmar con Jorge (mismo canal que resolvió "Intensive Outpatient", ver ` +
        `PROGRESS.md) y agregar el caso explícitamente a LOI_TO_PROGRAMS.`
    );
    this.name = "UnresolvedLOIError";
  }
}

export function getRequiredPrograms(loi: string): ProgramBlock[] {
  const programs = LOI_TO_PROGRAMS[loi as LOI];
  if (!programs) {
    throw new UnresolvedLOIError(loi);
  }
  return programs;
}

/** RN-2: rangos de horas válidos por bloque de programa (no una fórmula — un dominio). */
export const HOURS_RANGE: Record<Exclude<ProgramBlock, "CCP">, { min: number; max: number }> = {
  RE: { min: 8, max: 24 },
  EI: { min: 6, max: 20 },
  OP: { min: 20, max: 75 },
};

/** RN-2: Continuing Care Plan se mide en meses, no horas — valores discretos válidos. */
export const CC_MONTHS_VALID = [3, 6, 12] as const;

export function isValidHoursForProgram(program: Exclude<ProgramBlock, "CCP">, hours: number): boolean {
  const range = HOURS_RANGE[program];
  return hours >= range.min && hours <= range.max;
}

export function isValidCcMonths(months: number): boolean {
  return (CC_MONTHS_VALID as readonly number[]).includes(months);
}
