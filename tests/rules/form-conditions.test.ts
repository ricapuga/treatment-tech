import { describe, it, expect } from "vitest";
import {
  computeVisibleFieldKeys,
  findDanglingFieldReferences,
  type FormSchema,
} from "@/lib/rules/form-conditions";

const SCHEMA: FormSchema = {
  key: "demo",
  version: 1,
  titleEn: "Demo",
  titleEs: "Demo",
  fields: [
    { key: "bmcc_response", type: "radio", labelEn: "BMCC?", labelEs: "¿BMCC?" },
    { key: "bmcc_evidence", type: "textarea", labelEn: "Evidence", labelEs: "Evidencia" },
    { key: "bmcc_na", type: "text", labelEn: "N/A reason", labelEs: "Razón N/A" },
    { key: "always_visible", type: "text", labelEn: "Always", labelEs: "Siempre" },
  ],
  pages: [{ title: { en: "P1", es: "P1" }, fields: ["bmcc_response", "always_visible"] }],
  conditions: [
    { if: "bmcc_response", eq: "yes", show: ["bmcc_evidence"] },
    { if: "bmcc_response", eq: "no", show: ["bmcc_na"] },
  ],
};

describe("RN-7: visibilidad condicional declarativa", () => {
  it("un campo no referenciado en ninguna condición siempre es visible", () => {
    const visible = computeVisibleFieldKeys(SCHEMA, {});
    expect(visible.has("always_visible")).toBe(true);
  });

  it("un campo controlado por condición NO es visible si la condición no se cumple", () => {
    const visible = computeVisibleFieldKeys(SCHEMA, {});
    expect(visible.has("bmcc_evidence")).toBe(false);
    expect(visible.has("bmcc_na")).toBe(false);
  });

  it('responder "yes" muestra evidence y oculta na (caso BMCC del Gate M3)', () => {
    const visible = computeVisibleFieldKeys(SCHEMA, { bmcc_response: "yes" });
    expect(visible.has("bmcc_evidence")).toBe(true);
    expect(visible.has("bmcc_na")).toBe(false);
  });

  it('responder "no" muestra na y oculta evidence', () => {
    const visible = computeVisibleFieldKeys(SCHEMA, { bmcc_response: "no" });
    expect(visible.has("bmcc_na")).toBe(true);
    expect(visible.has("bmcc_evidence")).toBe(false);
  });

  it("findDanglingFieldReferences detecta una página con key inexistente", () => {
    const broken: FormSchema = {
      ...SCHEMA,
      pages: [{ title: { en: "P1", es: "P1" }, fields: ["no_existe"] }],
    };
    const problems = findDanglingFieldReferences(broken);
    expect(problems.length).toBeGreaterThan(0);
  });

  it("findDanglingFieldReferences detecta una condición con 'if' inexistente", () => {
    const broken: FormSchema = {
      ...SCHEMA,
      conditions: [{ if: "campo_fantasma", eq: "x", show: ["always_visible"] }],
    };
    const problems = findDanglingFieldReferences(broken);
    expect(problems.some((p) => p.includes("campo_fantasma"))).toBe(true);
  });

  it("un schema sano no reporta problemas", () => {
    expect(findDanglingFieldReferences(SCHEMA)).toEqual([]);
  });
});
