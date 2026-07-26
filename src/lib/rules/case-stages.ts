/**
 * Orden canónico de etapas del expediente — usado para sembrar `case_stages` al
 * admitir un caso y para pintar el StageMap del hub (/cases/[id]).
 *
 * Fuente: build-inputs/extracted/nav_graph.json (el orden real de navegación del
 * sistema de PDFs de Jorge: Forms 1-7 → Assessment → Treatment Plan → Case Review →
 * Activity Notes → Discharge/Continue Care) cruzado con los milestones M2-M4 del
 * blueprint, que curan cada uno de esos documentos por separado.
 *
 * DRAFT — a diferencia de RN-2 (LOI→programas), este orden no es una regla clínica
 * con implicación legal, así que no se bloquea el avance esperando curación. Pero si
 * Jorge usa un orden distinto en la práctica, este es el lugar a corregir (una lista,
 * no lógica dispersa) antes de que M3 empiece a curar los schemas de cada etapa.
 */
export const CASE_STAGE_ORDER = [
  "intake",
  "assessment",
  "treatment_plan",
  "case_review",
  "continue_care",
  "discharge",
] as const;

export type CaseStage = (typeof CASE_STAGE_ORDER)[number];

export const CASE_STAGE_LABEL: Record<CaseStage, { es: string; en: string }> = {
  intake: { es: "Admisión (Forms 1-7)", en: "Intake (Forms 1-7)" },
  assessment: { es: "Evaluación", en: "Assessment" },
  treatment_plan: { es: "Plan de tratamiento", en: "Treatment plan" },
  case_review: { es: "Revisión de caso", en: "Case review" },
  continue_care: { es: "Plan de cuidado continuo", en: "Continuing care plan" },
  discharge: { es: "Egreso", en: "Discharge" },
};
