import { describe, it, expect } from "vitest";
import { CASE_STAGE_ORDER, CASE_STAGE_LABEL } from "@/lib/rules/case-stages";

describe("case-stages: orden canónico", () => {
  it("toda etapa en CASE_STAGE_ORDER tiene etiqueta es/en", () => {
    for (const stage of CASE_STAGE_ORDER) {
      expect(CASE_STAGE_LABEL[stage]).toBeDefined();
      expect(CASE_STAGE_LABEL[stage].es.length).toBeGreaterThan(0);
      expect(CASE_STAGE_LABEL[stage].en.length).toBeGreaterThan(0);
    }
  });

  it("intake es la primera etapa (es la que arranca in_progress al admitir)", () => {
    expect(CASE_STAGE_ORDER[0]).toBe("intake");
  });

  it("no hay etapas duplicadas", () => {
    expect(new Set(CASE_STAGE_ORDER).size).toBe(CASE_STAGE_ORDER.length);
  });
});
