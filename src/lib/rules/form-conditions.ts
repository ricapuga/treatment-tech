/**
 * RN-7 (blueprint Sección 7 y 12) — visibilidad condicional declarativa: las reglas
 * de mostrar/ocultar de Assessment, urine screen y cartas viven en `form_schemas.schema`
 * como condiciones `{if: campo, eq: valor, show: [campos]}`, generadas desde los
 * scripts extraídos de los PDF — NUNCA re-programadas a mano por formulario.
 *
 * Este archivo es el motor de evaluación (puro, testeado) que interpreta esas
 * condiciones contra los datos capturados. No sabe nada de React ni de un formulario
 * en particular — <SchemaForm/> (src/components/form-engine/) lo usa para decidir qué
 * campo pintar en cada render.
 *
 * Regla de visibilidad por defecto: un campo que NO aparece como `show` target de
 * ninguna condición es visible siempre. Un campo que SÍ aparece como target de al
 * menos una condición solo es visible si ALGUNA de esas condiciones se cumple (OR) —
 * mismo comportamiento que "mostrar si aplica cualquiera de los disparadores", que es
 * el patrón que domina en los `field_scripts.json` originales (ver blueprint 261).
 */

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "select"
  | "radio"
  | "checkbox";

export interface FormField {
  key: string;
  type: FieldType;
  labelEn: string;
  labelEs: string;
  required?: boolean;
  /** Para select/radio: lista de {value, labelEn, labelEs}. */
  options?: { value: string; labelEn: string; labelEs: string }[];
}

export interface FormCondition {
  if: string; // key del campo disparador
  eq: string | number | boolean; // valor que activa la condición
  show: string[]; // keys de campos que se muestran cuando se cumple
}

export interface FormPage {
  title: { en: string; es: string };
  fields: string[]; // keys, en orden — referencian FormSchema.fields
}

export interface FormSchema {
  key: string;
  version: number;
  titleEn: string;
  titleEs: string;
  fields: FormField[];
  pages: FormPage[];
  conditions?: FormCondition[];
}

export type FormData = Record<string, string | number | boolean | undefined>;

export function computeVisibleFieldKeys(
  schema: FormSchema,
  data: FormData
): Set<string> {
  const conditions = schema.conditions ?? [];
  const controlled = new Set(conditions.flatMap((c) => c.show));

  const visible = new Set<string>();
  for (const field of schema.fields) {
    if (!controlled.has(field.key)) {
      visible.add(field.key);
    }
  }

  for (const condition of conditions) {
    if (data[condition.if] === condition.eq) {
      for (const key of condition.show) {
        visible.add(key);
      }
    }
  }

  return visible;
}

/** Valida que toda condición y toda página referencien keys de campo que existen —
 * un typo en un `show`/`if`/página apunta a un campo fantasma en silencio si no se
 * revisa. Se usa al cargar un schema, no en cada render (es barato pero no gratis). */
export function findDanglingFieldReferences(schema: FormSchema): string[] {
  const known = new Set(schema.fields.map((f) => f.key));
  const problems: string[] = [];

  for (const page of schema.pages) {
    for (const key of page.fields) {
      if (!known.has(key)) problems.push(`página "${page.title.en}" referencia campo desconocido "${key}"`);
    }
  }
  for (const condition of schema.conditions ?? []) {
    if (!known.has(condition.if)) {
      problems.push(`condición referencia campo "if" desconocido "${condition.if}"`);
    }
    for (const key of condition.show) {
      if (!known.has(key)) problems.push(`condición referencia campo "show" desconocido "${key}"`);
    }
  }
  return problems;
}
