import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { findDanglingFieldReferences, type FormSchema } from "@/lib/rules/form-conditions";

/**
 * build-inputs/curated/activity_notes_12.schema.json es el quinto contenido clínico
 * REAL curado — primera de tres variantes de "Activity Notes" (12/20/75 horas), contra
 * build-inputs/templates-r12/activity-notes-12.pdf ("EARLY INTERVENTION PROGRAM", 2
 * páginas, 102 campos del AcroForm original / 94 curados — ver
 * build_activity_notes_12_schema.py para el detalle de por qué 8 campos se omiten
 * deliberadamente).
 *
 * Estructura de 8 "filas" con 3 formas distintas (admisión, sesión x6, salida) — ver
 * docstring del generador para el detalle completo. Sin condiciones RN-7.
 */
const schema: FormSchema = JSON.parse(
  readFileSync("build-inputs/curated/activity_notes_12.schema.json", "utf-8")
);

describe("activity_notes_12.schema.json (contenido curado real)", () => {
  it("no tiene referencias colgantes (page/condition que apunte a un campo inexistente)", () => {
    expect(findDanglingFieldReferences(schema)).toEqual([]);
  });

  it("no tiene condiciones RN-7 (field_scripts.json de este módulo solo trae formateo de fecha)", () => {
    expect(schema.conditions ?? []).toHaveLength(0);
  });

  it("tiene las 2 páginas esperadas", () => {
    expect(schema.pages).toHaveLength(2);
  });

  it("94 campos curados (102 reales del AcroForm menos 8 'a.*' redundantes, uno por fila), sin llaves duplicadas", () => {
    expect(schema.fields).toHaveLength(94);
    const keys = schema.fields.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("encabezado del caso (client_name/admission_date/hours_recommended) no colisiona con la fecha de la fila de admisión (admission_note_date)", () => {
    expect(schema.fields.some((f) => f.key === "admission_date")).toBe(true);
    expect(schema.fields.some((f) => f.key === "admission_note_date")).toBe(true);
    expect(schema.fields.filter((f) => f.key === "admission_date")).toHaveLength(1);
  });

  it("la fila de admisión tiene el resumen demográfico real (13 frases) y NO tiene Topic/D/A/P", () => {
    const demo = schema.fields.find((f) => f.key === "admission_demographic_summary");
    expect(demo?.options).toHaveLength(13);
    expect(schema.fields.some((f) => f.key === "admission_topic")).toBe(false);
  });

  it("hay exactamente 6 sesiones (session_01..session_06), cada una con Topic/Data/Assessment/Plan y su propio consejero", () => {
    for (let n = 1; n <= 6; n++) {
      const prefix = `session_${String(n).padStart(2, "0")}`;
      for (const suffix of ["topic", "data", "assessment", "plan", "counselor_name", "counselor_initials"]) {
        expect(schema.fields.some((f) => f.key === `${prefix}_${suffix}`)).toBe(true);
      }
    }
    expect(schema.fields.some((f) => f.key === "session_07_topic")).toBe(false);
  });

  it("las notas DAP (Data/Assessment/Plan) usan los catálogos reales del PDF, con conteos distintos por columna", () => {
    const data = schema.fields.find((f) => f.key === "session_01_data");
    const assessment = schema.fields.find((f) => f.key === "session_01_assessment");
    const plan = schema.fields.find((f) => f.key === "session_01_plan");
    const topic = schema.fields.find((f) => f.key === "session_01_topic");
    expect(data?.options).toHaveLength(47);
    expect(assessment?.options).toHaveLength(33);
    expect(plan?.options).toHaveLength(20);
    expect(topic?.options).toHaveLength(14);
  });

  it("cada sesión y la fila de admisión/salida pueden tener un consejero DISTINTO (a diferencia de assessment/treatment_plan/case_review, que declaran uno solo por documento)", () => {
    const counselorKeys = schema.fields.filter((f) => f.key.endsWith("_counselor_name"));
    // admission_note + 6 sesiones + exit = 8 campos de consejero independientes
    expect(counselorKeys).toHaveLength(8);
    for (const f of counselorKeys) {
      expect(f.options).toHaveLength(2);
    }
  });

  it("la fila de salida (exit) tiene nota libre y NO tiene resumen demográfico ni Topic/D/A/P", () => {
    expect(schema.fields.some((f) => f.key === "exit_note_text")).toBe(true);
    expect(schema.fields.some((f) => f.key === "exit_demographic_summary")).toBe(false);
    expect(schema.fields.some((f) => f.key === "exit_topic")).toBe(false);
  });

  it("no existe ningún campo para el <select> 'a.*' de duración (omitido deliberadamente por redundancia visual con el campo de texto de horas)", () => {
    expect(schema.fields.some((f) => f.key.includes("duration"))).toBe(false);
  });
});
