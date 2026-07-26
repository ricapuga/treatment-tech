/**
 * Orden canónico de etapas del expediente — usado para sembrar `case_stages` al
 * admitir un caso y para pintar el StageMap del hub (/cases/[id]).
 *
 * Fuente: build-inputs/extracted/nav_graph.json, confirmado por Jorge (documento
 * "Preguntas para Jorge — Treatment Tech", pregunta 1.1, respondido 2026-07-26):
 * Admisión → Evaluación/Plan de tratamiento → Revisión de caso/Notas de actividad →
 * Egreso → Plan de cuidado continuo/Finalización de servicios.
 *
 * CONFIRMADO — ya no es DRAFT. El borrador original tenía `continue_care` ANTES de
 * `discharge`; el mapa real de Process Control (y Jorge, directamente) confirman que
 * el egreso va primero. Corregido aquí.
 *
 * Nota de Jorge (pregunta 1.2): "Revisión de caso" NO tiene una cadencia fija — queda
 * a criterio del consejero, y en la práctica un mismo caso puede tener varias (hasta
 * 7 vistas en el sistema actual). Este `case_stages.case_review` sigue representando
 * "hay al menos una revisión en curso/completada", no cada revisión individual — las
 * revisiones concretas viven como filas repetidas en `documents` (schemaKey
 * "case_review"), igual que cualquier otro documento firmable. Pendiente de M3:
 * decidir la UI para listar/crear revisiones múltiples dentro de esa misma etapa.
 */
export const CASE_STAGE_ORDER = [
  "intake",
  "assessment",
  "treatment_plan",
  "case_review",
  "discharge",
  "continue_care",
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
