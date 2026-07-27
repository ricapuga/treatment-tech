import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { findDanglingFieldReferences, type FormSchema } from "@/lib/rules/form-conditions";

/**
 * build-inputs/curated/case_review.schema.json es el cuarto contenido clínico REAL
 * curado (después de forms_1_7, assessment, treatment_plan) — Case Review
 * ("Continued Service Review"), contra build-inputs/templates-r12/case-review.pdf
 * (2 páginas, 28 campos únicos del AcroForm original / 33 instancias de widget, ver
 * CaseReview/fields.json + field_scripts.json + option_catalogs.json). Ver
 * build_case_review_schema.py para los 4 hallazgos/simplificaciones documentados.
 *
 * Igual que treatment_plan.schema.json: field_scripts.json de este módulo no tiene
 * lógica condicional de mostrar/ocultar, así que no hay `conditions` que probar aquí
 * — la prueba cubre la forma del contenido curado.
 */
const schema: FormSchema = JSON.parse(
  readFileSync("build-inputs/curated/case_review.schema.json", "utf-8")
);

describe("case_review.schema.json (contenido curado real)", () => {
  it("no tiene referencias colgantes (page/condition que apunte a un campo inexistente)", () => {
    expect(findDanglingFieldReferences(schema)).toEqual([]);
  });

  it("no tiene condiciones RN-7 (field_scripts.json de este módulo no tiene lógica de mostrar/ocultar)", () => {
    expect(schema.conditions ?? []).toHaveLength(0);
  });

  it("tiene las 2 páginas esperadas, en el orden real del PDF", () => {
    expect(schema.pages.map((p) => p.title.en)).toEqual([
      "Continued Service Review",
      "Treatment Plan Progress, ASAM Placement & Signatures",
    ]);
  });

  it("32 campos curados, sin llaves duplicadas", () => {
    expect(schema.fields).toHaveLength(32);
    const keys = schema.fields.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("patient_name se declara una sola vez (página 1) y se reusa (no repite) en la página 2", () => {
    expect(schema.fields.filter((f) => f.key === "patient_name")).toHaveLength(1);
    expect(schema.pages[0].fields).toContain("patient_name");
    expect(schema.pages[1].fields).toContain("patient_name");
  });

  it("Dimensión 1 tiene un solo campo de estado (dim1_status) — a diferencia de las Dimensiones 2-6, que tienen 3 notas de progreso cada una", () => {
    expect(schema.pages[0].fields.filter((k) => k.startsWith("dim1_"))).toEqual(["dim1_status"]);
    for (const dim of [2, 3, 4, 5, 6]) {
      const keys = schema.pages[0].fields.filter((k) => k.startsWith(`dim${dim}_notes_`));
      expect(keys).toEqual([`dim${dim}_notes_1`, `dim${dim}_notes_2`, `dim${dim}_notes_3`]);
    }
  });

  it("dim1_status tiene la única opción real del PDF (no se inventan más opciones aunque sea un <select> de una sola opción)", () => {
    const dim1 = schema.fields.find((f) => f.key === "dim1_status");
    expect(dim1?.options).toHaveLength(1);
    expect(dim1?.options?.[0]?.value).toBe(
      "Patient presents no signs of intoxication or withdrawals at this time."
    );
  });

  it("las 3 fechas (review_date, patient_review_date, counselor_signature_date) son keys DISTINTAS — el PDF real comparte un solo campo 'Text2' sincronizado, no se replica ese bug de nomenclatura", () => {
    const dateKeys = ["review_date", "patient_review_date", "counselor_signature_date"];
    expect(new Set(dateKeys).size).toBe(dateKeys.length);
    for (const key of dateKeys) {
      expect(schema.fields.filter((f) => f.key === key)).toHaveLength(1);
    }
  });

  it("el progreso de metas/objetivos usa las 10 opciones reales de porcentaje (10%-100%)", () => {
    const goals = schema.fields.find((f) => f.key === "treatment_goals_progress");
    expect(goals?.options).toHaveLength(10);
    expect(goals?.options?.[0]?.value).toBe("10 %");
    const objectives = schema.fields.find((f) => f.key === "treatment_objectives_progress");
    expect(objectives?.options).toHaveLength(10);
  });

  it("diagnosis_line_* usa los 36 códigos DSM-5 reales (mismo catálogo que treatment_plan)", () => {
    for (const i of [1, 2, 3]) {
      const dx = schema.fields.find((f) => f.key === `diagnosis_line_${i}`);
      expect(dx?.options).toHaveLength(36);
    }
  });

  it("asam_recommendation usa las 15 opciones reales de colocación ASAM (aunque el PDF lo etiqueta 'Recommendations', el contenido real es la escala ASAM)", () => {
    const asam = schema.fields.find((f) => f.key === "asam_recommendation");
    expect(asam?.options).toHaveLength(15);
    expect(asam?.options?.[0]?.value).toBe("Recovery Residence - RR Recovery Residence");
  });

  it("no existe ningún campo para el encabezado 'ASAM PLACEMENT' en sí — es solo un título de agrupación visual en el PDF, no un dato capturable", () => {
    expect(schema.fields.some((f) => f.key === "asam_placement")).toBe(false);
  });
});
