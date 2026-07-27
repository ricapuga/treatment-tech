import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import {
  computeVisibleFieldKeys,
  findDanglingFieldReferences,
  type FormSchema,
} from "@/lib/rules/form-conditions";

/**
 * build-inputs/curated/assessment.schema.json es el segundo contenido clínico REAL
 * curado (después de forms_1_7) — Biopsychosocial Assessment, ASAM 6 dimensiones,
 * contra build-inputs/templates-r12/assessment.pdf (12 páginas, ~360 campos reales
 * del AcroForm original, ver Assessment/fields.json + field_scripts.json +
 * option_catalogs.json). Mucho más grande que forms_1_7 (351 campos curados vs 52) —
 * ver build_assessment_schema.py para las simplificaciones documentadas frente al PDF
 * original (tablas "N/A" colapsadas a un campo, campos sin lista de opciones
 * confirmada dejados como texto libre en vez de inventar).
 *
 * Igual que forms-1-7-schema.test.ts: esta prueba no es sobre el motor genérico (eso
 * ya lo cubre tests/rules/form-conditions.test.ts) — es sobre que ESTE archivo de
 * contenido esté bien formado y que los 4 patrones reales de "¿Sí/No? -> tabla de
 * episodios o N/A" (extraídos de field_scripts.json: BMCC, DIM3PS, DIM3ADRA, DIM5RL)
 * funcionen con datos reales.
 */
const schema: FormSchema = JSON.parse(
  readFileSync("build-inputs/curated/assessment.schema.json", "utf-8")
);

describe("assessment.schema.json (contenido curado real)", () => {
  it("no tiene referencias colgantes (page/condition que apunte a un campo inexistente)", () => {
    expect(findDanglingFieldReferences(schema)).toEqual([]);
  });

  it("tiene las 12 páginas esperadas, en el orden de las 6 dimensiones ASAM + conclusiones + firma", () => {
    expect(schema.pages.map((p) => p.title.en)).toEqual([
      "Dimension 1 — Substance Use History",
      "Dimension 1 — DSM-5 Criteria",
      "Dimension 2 — Biomedical Conditions (Hospitalizations)",
      "Dimension 2 — STDs and Tuberculosis",
      "Dimension 3 — Psychiatric and Cognitive Conditions",
      "Dimension 3 — Psychiatric Hospitalizations and Legal History",
      "Dimension 4 — Substance Use Related Risks",
      "Dimension 5 — Recovery Environment Interactions (I)",
      "Dimension 5 — Recovery Environment Interactions (II)",
      "Dimension 6 — Person-Centered Considerations",
      "Assessment Conclusions",
      "DSM-5 Diagnosis, ASAM Placement & Signatures",
    ]);
  });

  it("351 campos curados, sin llaves duplicadas", () => {
    expect(schema.fields).toHaveLength(351);
    const keys = schema.fields.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("8 condiciones RN-7, las 4 parejas Sí/No de field_scripts.json (BMCC/DIM3PS/DIM3ADRA/DIM5RL)", () => {
    expect(schema.conditions).toHaveLength(8);
    const triggers = new Set(schema.conditions?.map((c) => c.if));
    expect(triggers).toEqual(
      new Set([
        "dim2_hospitalizations_yn",
        "dim3_psychiatric_treatment_yn",
        "dim3_arrests_yn",
        "dim4_prior_treatment_yn",
      ])
    );
  });

  it("hospitalizaciones médicas = Sí: muestra la tabla de 3 episodios, oculta el campo N/A", () => {
    const visible = computeVisibleFieldKeys(schema, { dim2_hospitalizations_yn: "Yes" });
    expect(visible.has("dim2_episode_1_facility")).toBe(true);
    expect(visible.has("dim2_episode_3_status")).toBe(true);
    expect(visible.has("dim2_hospitalizations_na")).toBe(false);
  });

  it("hospitalizaciones médicas = No: oculta la tabla de episodios, muestra el campo N/A", () => {
    const visible = computeVisibleFieldKeys(schema, { dim2_hospitalizations_yn: "No" });
    expect(visible.has("dim2_episode_1_facility")).toBe(false);
    expect(visible.has("dim2_hospitalizations_na")).toBe(true);
  });

  it("sin responder ninguna de las 4 preguntas Sí/No: ninguna tabla de episodios ni campo N/A es visible", () => {
    const visible = computeVisibleFieldKeys(schema, {});
    for (const key of [
      "dim2_episode_1_facility",
      "dim2_hospitalizations_na",
      "dim3_psych_episode_1_facility",
      "dim3_psychiatric_na",
      "dim3_arrest_case_1_offense_type",
      "dim3_arrests_na",
      "dim4_treatment_episode_1_facility",
      "dim4_treatment_na",
    ]) {
      expect(visible.has(key)).toBe(false);
    }
  });

  it("campos de encabezado (página 1) y de conclusiones (página 11) son siempre visibles", () => {
    const visible = computeVisibleFieldKeys(schema, {});
    expect(visible.has("client_name")).toBe(true);
    expect(visible.has("counselor_name")).toBe(true);
    expect(visible.has("conclusion_dim1_problem_identified")).toBe(true);
    expect(visible.has("physician_review_needed")).toBe(true);
  });

  it("la grilla DSM-5 (36 Never/Sometimes/Frequently + 8 Yes/No/I'm not sure) tiene las opciones reales del PDF, no inventadas", () => {
    const larger = schema.fields.find((f) => f.key === "dim1_dsm5_larger_amounts_1");
    expect(larger?.options?.map((o) => o.value)).toEqual(["Never", "Sometimes", "Frequently"]);
    const tolerance = schema.fields.find((f) => f.key === "dim1_dsm5_tolerance_1");
    expect(tolerance?.options?.map((o) => o.value)).toEqual(["Yes", "No", "I'm not sure"]);
  });

  it("asam_placement y diagnosis_line_* usan las listas reales extraídas del PDF (no genéricas)", () => {
    const asam = schema.fields.find((f) => f.key === "asam_placement");
    expect(asam?.options?.[0]?.value).toBe("Recovery Residence - RR Recovery Residence");
    expect(asam?.options?.length).toBe(15);
    const dx = schema.fields.find((f) => f.key === "diagnosis_line_1");
    expect(dx?.options?.length).toBe(37); // 37 códigos reales (sin contar "Z03.89 No Diagnosis" ya incluido)
  });

  it("counselor_name no se repite en la página 12 (mismo campo AcroForm sincronizado, RN de no repetir captura)", () => {
    const page12 = schema.pages[11];
    expect(page12.fields.includes("counselor_name")).toBe(false);
    expect(schema.fields.filter((f) => f.key === "counselor_name")).toHaveLength(1);
  });
});
