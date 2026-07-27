import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import {
  computeVisibleFieldKeys,
  findDanglingFieldReferences,
  type FormSchema,
} from "@/lib/rules/form-conditions";

/**
 * build-inputs/curated/forms_1_7.schema.json es el primer contenido clínico REAL
 * (no demo) que carga el motor de formularios — curado en esta sesión contra
 * build-inputs/templates-r12/forms-1-7.pdf (98 campos reales del AcroForm original,
 * ver Forms_1-7/fields.json y field_scripts.json). Esta prueba no es sobre el motor
 * (eso ya lo cubre tests/rules/form-conditions.test.ts) — es sobre que ESTE archivo
 * de contenido específico esté bien formado y que la integración RN-2 -> RN-7 (las
 * banderas program_re/ei/op/ccp que inyecta forms/[key]/page.tsx) funcione con datos
 * reales, no con el schema demo_intake de prueba.
 */
const schema: FormSchema = JSON.parse(
  readFileSync("build-inputs/curated/forms_1_7.schema.json", "utf-8")
);

describe("forms_1_7.schema.json (contenido curado real)", () => {
  it("no tiene referencias colgantes (page/condition que apunte a un campo inexistente)", () => {
    expect(findDanglingFieldReferences(schema)).toEqual([]);
  });

  it("tiene las 3 páginas esperadas: Demographic Data, Program Requirements, Fees", () => {
    expect(schema.pages.map((p) => p.title.en)).toEqual([
      "Demographic Data",
      "Program Requirements",
      "Fees & Financial Responsibility",
    ]);
  });

  it("52 campos: 35 de admisión + 4 banderas de programa (RN-2) + 4 info (RN Program Requirements) + 9 de cuotas", () => {
    expect(schema.fields).toHaveLength(52);
  });

  it("las banderas program_* no se listan en ninguna página (no se piden al usuario)", () => {
    const allPageFields = new Set(schema.pages.flatMap((p) => p.fields));
    for (const key of ["program_re", "program_ei", "program_op", "program_ccp"]) {
      expect(allPageFields.has(key)).toBe(false);
    }
  });

  it("Significant Risk (RE+OP+CCP): muestra los 3 bloques, NO el de Early Intervention", () => {
    const visible = computeVisibleFieldKeys(schema, {
      program_re: true,
      program_ei: false,
      program_op: true,
      program_ccp: true,
    });
    expect(visible.has("re_hours")).toBe(true);
    expect(visible.has("risk_education_info")).toBe(true);
    expect(visible.has("op_hours")).toBe(true);
    expect(visible.has("ccp_months")).toBe(true);
    expect(visible.has("ei_hours")).toBe(false);
    expect(visible.has("early_intervention_info")).toBe(false);
  });

  it("Early Intervention Program (solo EI): muestra solo el bloque de EI", () => {
    const visible = computeVisibleFieldKeys(schema, {
      program_re: false,
      program_ei: true,
      program_op: false,
      program_ccp: false,
    });
    expect(visible.has("ei_hours")).toBe(true);
    expect(visible.has("re_hours")).toBe(false);
    expect(visible.has("op_hours")).toBe(false);
    expect(visible.has("ccp_months")).toBe(false);
  });

  it("LOI sin resolver (RN-2 UnresolvedLOIError aguas arriba): sin banderas, no se muestra ningún bloque de programa", () => {
    const visible = computeVisibleFieldKeys(schema, {});
    for (const key of [
      "re_hours",
      "ei_hours",
      "op_hours",
      "ccp_months",
      "risk_education_info",
      "early_intervention_info",
      "outpatient_info",
      "continuing_care_info",
    ]) {
      expect(visible.has(key)).toBe(false);
    }
  });

  it("campos de admisión (page 1) son siempre visibles, no dependen de program_*", () => {
    const visible = computeVisibleFieldKeys(schema, {});
    expect(visible.has("patient_name")).toBe(true);
    expect(visible.has("date_of_birth")).toBe(true);
    expect(visible.has("comments")).toBe(true);
  });
});
