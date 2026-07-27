import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { findDanglingFieldReferences, type FormSchema } from "@/lib/rules/form-conditions";

/**
 * build-inputs/curated/treatment_plan.schema.json es el tercer contenido clínico REAL
 * curado (después de forms_1_7 y assessment) — Treatment Plan, ASAM 6 dimensiones,
 * contra build-inputs/templates-r12/treatment-plan.pdf (7 páginas, 78 campos únicos del
 * AcroForm original / 128 instancias de widget, ver TreatmentPlan/fields.json +
 * field_scripts.json + option_catalogs.json). Ver build_treatment_plan_schema.py para
 * las 10 simplificaciones/hallazgos documentados frente al PDF original.
 *
 * A diferencia de assessment.schema.json, este módulo NO tiene ninguna condición RN-7
 * (field_scripts.json solo trae scripts de formateo de fecha, sin lógica de mostrar/
 * ocultar) — por eso esta prueba no cubre `computeVisibleFieldKeys`, solo la forma del
 * contenido curado (páginas, campos, opciones reales, ausencia estructural real de la
 * Dimensión 1, y las keys de fecha separadas por el bug de sincronización "Text2"/"Date"
 * del PDF original).
 */
const schema: FormSchema = JSON.parse(
  readFileSync("build-inputs/curated/treatment_plan.schema.json", "utf-8")
);

describe("treatment_plan.schema.json (contenido curado real)", () => {
  it("no tiene referencias colgantes (page/condition que apunte a un campo inexistente)", () => {
    expect(findDanglingFieldReferences(schema)).toEqual([]);
  });

  it("no tiene condiciones RN-7 (field_scripts.json de este módulo no tiene lógica de mostrar/ocultar)", () => {
    expect(schema.conditions ?? []).toHaveLength(0);
  });

  it("tiene las 7 páginas esperadas, en el orden de las 6 dimensiones ASAM + plan educativo/firmas", () => {
    expect(schema.pages.map((p) => p.title.en)).toEqual([
      "Dimension 1 — Intoxication, Withdrawal, and Addictions Medications",
      "Dimension 2 — Biomedical Conditions",
      "Dimension 3 — Psychiatric and Cognitive Conditions",
      "Dimension 4 — Substance Use Related Risks",
      "Dimension 5 — Recovery Environment Interactions",
      "Dimension 6 — Person-Centered Considerations",
      "Educational Plan, Medications, Discharge Criteria & Signatures",
    ]);
  });

  it("85 campos curados, sin llaves duplicadas", () => {
    expect(schema.fields).toHaveLength(85);
    const keys = schema.fields.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("encabezado (client_name/counselor_name/diagnosis_line_*) se declara una sola vez, en la página 1", () => {
    for (const key of ["client_name", "counselor_name", "diagnosis_line_1", "diagnosis_line_5"]) {
      expect(schema.fields.filter((f) => f.key === key)).toHaveLength(1);
    }
    expect(schema.pages[0].fields).toContain("client_name");
    expect(schema.pages[0].fields).toContain("counselor_name");
    // Páginas 2-7 REUSAN client_name/counselor_name (mismo campo AcroForm sincronizado)
    // pero NO repiten diagnosis_line_* (esos solo se muestran en el encabezado página 1).
    for (const p of schema.pages.slice(1)) {
      expect(p.fields).not.toContain("diagnosis_line_1");
    }
    // La página 7 sí reusa client_name/counselor_name (bloque de firmas "I, ___, have
    // reviewed this treatment plan...") — confirmando el patrón de reuso, no de repetición.
    expect(schema.pages[6].fields).toContain("client_name");
    expect(schema.pages[6].fields).toContain("counselor_name");
  });

  it("Dimensión 1 NO tiene evidenced_by/goal/objective/methods/comments — ausencia real del AcroForm, no un olvido de curación", () => {
    const dim1Keys = schema.pages[0].fields;
    for (const suffix of ["evidenced_by", "goal", "objective_1", "methods_1", "comments"]) {
      expect(dim1Keys.some((k) => k === `dim1_${suffix}`)).toBe(false);
    }
    expect(dim1Keys).toContain("dim1_target_date");
    expect(dim1Keys).toContain("dim1_problem");
    const problem = schema.fields.find((f) => f.key === "dim1_problem");
    expect(problem?.type).toBe("textarea");
  });

  it("Dimensiones 2-6 siguen el patrón uniforme Problem/Evidenced by/Goal/Objectives x3/Methods x3/Comments", () => {
    for (let dim = 2; dim <= 6; dim++) {
      const keys = [
        `dim${dim}_target_date`,
        `dim${dim}_problem`,
        `dim${dim}_evidenced_by`,
        `dim${dim}_goal`,
        `dim${dim}_objective_1`,
        `dim${dim}_objective_2`,
        `dim${dim}_objective_3`,
        `dim${dim}_methods_1`,
        `dim${dim}_methods_2`,
        `dim${dim}_methods_3`,
        `dim${dim}_comments`,
      ];
      for (const key of keys) {
        expect(schema.fields.some((f) => f.key === key)).toBe(true);
      }
    }
  });

  it("las 6 fechas objetivo por dimensión + la del plan educativo son keys DISTINTAS (el PDF real comparte un solo campo 'Text2' sincronizado entre las 7 páginas — no se replica ese bug de nomenclatura)", () => {
    const dateKeys = [
      "dim2_target_date",
      "dim3_target_date",
      "dim4_target_date",
      "dim5_target_date",
      "dim6_target_date",
      "edu_plan_target_date",
    ];
    expect(new Set(dateKeys).size).toBe(dateKeys.length);
    for (const key of dateKeys) {
      expect(schema.fields.filter((f) => f.key === key)).toHaveLength(1);
    }
  });

  it("las fechas de firma (paciente/consejero) son keys distintas entre sí y del plan_date del encabezado (mismo bug real de campo 'Date' compartido, no replicado)", () => {
    const signatureDateKeys = ["plan_date", "patient_review_date", "counselor_signature_date"];
    expect(new Set(signatureDateKeys).size).toBe(signatureDateKeys.length);
  });

  it("las listas de opciones son las reales de option_catalogs.json, no genéricas", () => {
    const problem = schema.fields.find((f) => f.key === "dim2_problem");
    expect(problem?.options?.[0]?.value).toBe("Patient reported no biomedical issues or conditions at this time.");
    const yn = schema.fields.find((f) => f.key === "medication_needed_yn");
    expect(yn?.options?.map((o) => o.value)).toEqual(["Yes", "No"]);
    const ccp = schema.fields.find((f) => f.key === "continuing_care_plan");
    expect(ccp?.options).toHaveLength(3);
  });

  it("diagnosis_line_* usa 36 códigos reales — idénticos a assessment MENOS 'Z03.89 No Diagnosis'", () => {
    const dx = schema.fields.find((f) => f.key === "diagnosis_line_1");
    expect(dx?.options).toHaveLength(36);
    expect(dx?.options?.some((o) => o.value === "Z03.89 No Diagnosis")).toBe(false);
  });

  it("continued_stay_review_criteria es un bloque info de solo lectura (boilerplate ASAM PPC fijo, no un dato editable por caso)", () => {
    const criteria = schema.fields.find((f) => f.key === "continued_stay_review_criteria");
    expect(criteria?.type).toBe("info");
    expect(criteria?.bodyEn).toMatch(/60 calendar days/);
  });

  it("tabla de medicamentos: 3 filas x (nombre/razón/dosis), siempre visible (sin condición Sí/No que la oculte, fiel al PDF real)", () => {
    for (const row of [1, 2, 3]) {
      for (const col of ["name", "reason", "dose"]) {
        const key = `medication_${row}_${col}`;
        expect(schema.fields.some((f) => f.key === key)).toBe(true);
        expect(schema.pages[6].fields).toContain(key);
      }
    }
  });
});
