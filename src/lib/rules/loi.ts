/**
 * RN-2 (blueprint Sección 7, "Reglas de negocio") — LOI → programas.
 *
 * Minimal Risk → [RE]; Moderate Risk → [RE, EI]; Significant Risk → [RE, OP, CCP];
 * High Risk → [OP, CCP]; Risk Education → [RE]; Early Intervention → [EI];
 * Outpatient → [OP, CCP].
 *
 * "Intensive Outpatient" aparece en el catálogo de `cases.loi` (ver Sección 7,
 * comentario del campo) pero RN-2 no especifica su mapeo de programas de forma
 * explícita. En vez de adivinar, se deja sin resolver aquí a propósito — se cura en
 * M3 contra `build-inputs/extracted/Admissions/field_scripts.json` (la lógica real
 * del dropdown), no se inventa. Ver TODO en getRequiredPrograms().
 */

export type ProgramBlock = "RE" | "EI" | "OP" | "CCP";

export type LOI =
  | "Minimal Risk"
  | "Moderate Risk"
  | "Significant Risk"
  | "High Risk"
  | "Risk Education"
  | "Early Intervention"
  | "Outpatient";

const LOI_TO_PROGRAMS: Record<LOI, ProgramBlock[]> = {
  "Minimal Risk": ["RE"],
  "Moderate Risk": ["RE", "EI"],
  "Significant Risk": ["RE", "OP", "CCP"],
  "High Risk": ["OP", "CCP"],
  "Risk Education": ["RE"],
  "Early Intervention": ["EI"],
  Outpatient: ["OP", "CCP"],
};

export class UnresolvedLOIError extends Error {
  constructor(loi: string) {
    super(
      `LOI "${loi}" no tiene mapeo de programas resuelto en RN-2. No se asume — ` +
        `revisar build-inputs/extracted/Admissions/field_scripts.json y agregar el ` +
        `caso explícitamente a LOI_TO_PROGRAMS (ver TODO M3 en src/lib/rules/loi.ts). ` +
        `Candidato conocido pendiente: "Intensive Outpatient".`
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
